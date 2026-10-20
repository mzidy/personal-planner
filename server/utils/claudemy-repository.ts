import { and, asc, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import type {
  ClaudemyCourseRecord,
  ClaudemyCourseSummary,
  ClaudemyCourseView,
  ClaudemyLessonRecord,
  ClaudemyLevel,
  ClaudemyNote,
  ClaudemyPageStatus,
  ClaudemyPageSummary,
  ClaudemyPlanBlock
} from '~~/shared/types/claudemy'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

/** A step that has held the lease this long is assumed dead (the function limit is 300 s). */
const STEP_LEASE_MS = 330_000

function nowIso() {
  return new Date().toISOString()
}

type CourseRow = typeof tables.claudemyCourses.$inferSelect
type PageRow = typeof tables.claudemyPages.$inferSelect
type LessonRow = typeof tables.claudemyLessons.$inferSelect

export interface ClaudemyPage extends Omit<PageRow, 'status' | 'notes'> {
  status: ClaudemyPageStatus
  notes: ClaudemyNote[]
}

function toCourse(row: CourseRow): ClaudemyCourseRecord {
  const { userId: _userId, stepStartedAt: _stepStartedAt, ...rest } = row
  return rest as unknown as ClaudemyCourseRecord
}

function toPage(row: PageRow): ClaudemyPage {
  return row as unknown as ClaudemyPage
}

function toLesson(row: LessonRow): ClaudemyLessonRecord {
  const { userId: _userId, ...rest } = row
  return rest as unknown as ClaudemyLessonRecord
}

export function pageSummary(page: ClaudemyPage): ClaudemyPageSummary {
  return {
    id: page.id,
    seq: page.seq,
    url: page.url,
    title: page.title,
    kind: page.kind,
    subtopics: page.subtopics,
    status: page.status,
    failReason: page.failReason,
    words: page.words,
    read: Boolean(page.readAt),
    skipReason: page.skipReason,
    noteCount: page.notes.length
  }
}

export function useClaudemyRepository() {
  return {
    async listCourses(userId: string): Promise<ClaudemyCourseSummary[]> {
      const db = useDatabase()
      const rows = await db
        .select({
          course: tables.claudemyCourses,
          lessonsWritten: sql<number>`count(case when ${tables.claudemyLessons.status} = 'written' then 1 end)`,
          lessonsHeard: sql<number>`count(${tables.claudemyLessons.heardAt})`
        })
        .from(tables.claudemyCourses)
        .leftJoin(tables.claudemyLessons, eq(tables.claudemyLessons.courseId, tables.claudemyCourses.id))
        .where(eq(tables.claudemyCourses.userId, userId))
        .groupBy(tables.claudemyCourses.id)
        .orderBy(desc(tables.claudemyCourses.updatedAt))

      return rows.map(row => ({
        id: row.course.id,
        topic: row.course.topic,
        level: row.course.level as ClaudemyLevel,
        person: row.course.person,
        stage: row.course.stage as ClaudemyCourseSummary['stage'],
        error: row.course.error,
        lessonCount: row.course.lessonCount,
        lessonsWritten: Number(row.lessonsWritten ?? 0),
        lessonsHeard: Number(row.lessonsHeard ?? 0),
        updatedAt: row.course.updatedAt
      }))
    },

    async createCourse(
      userId: string,
      input: { topic: string; level: ClaudemyLevel; lessonCount: number; person: string }
    ): Promise<ClaudemyCourseRecord> {
      const row: CourseRow = {
        id: createId('course'),
        userId,
        topic: input.topic,
        level: input.level,
        lessonCount: input.lessonCount,
        person: input.person,
        stage: 'mapping',
        error: '',
        stepStartedAt: null,
        sourcingRound: 0,
        sourcingCursor: 0,
        subtopics: [],
        themes: [],
        splits: [],
        gaps: [],
        arcs: [],
        disagreements: [],
        stories: [],
        feedback: '',
        inputTokens: 0,
        outputTokens: 0,
        webSearches: 0,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await useDatabase().insert(tables.claudemyCourses).values(row)
      return toCourse(row)
    },

    async findCourse(userId: string, courseId: string): Promise<ClaudemyCourseRecord | null> {
      const [row] = await useDatabase()
        .select()
        .from(tables.claudemyCourses)
        .where(and(eq(tables.claudemyCourses.userId, userId), eq(tables.claudemyCourses.id, courseId)))
        .limit(1)
      return row ? toCourse(row) : null
    },

    async updateCourse(courseId: string, patch: Partial<Omit<ClaudemyCourseRecord, 'id' | 'createdAt'>>) {
      await useDatabase()
        .update(tables.claudemyCourses)
        .set({ ...(patch as Partial<CourseRow>), updatedAt: nowIso() })
        .where(eq(tables.claudemyCourses.id, courseId))
    },

    async addUsage(courseId: string, usage: { inputTokens: number; outputTokens: number; webSearches: number }) {
      await useDatabase()
        .update(tables.claudemyCourses)
        .set({
          inputTokens: sql`${tables.claudemyCourses.inputTokens} + ${usage.inputTokens}`,
          outputTokens: sql`${tables.claudemyCourses.outputTokens} + ${usage.outputTokens}`,
          webSearches: sql`${tables.claudemyCourses.webSearches} + ${usage.webSearches}`
        })
        .where(eq(tables.claudemyCourses.id, courseId))
    },

    /**
     * Takes the course's step lease. False when another request is already
     * running a step, so two open tabs cannot do (and pay for) the same work.
     */
    async acquireStep(courseId: string) {
      const stale = new Date(Date.now() - STEP_LEASE_MS).toISOString()
      const taken = await useDatabase()
        .update(tables.claudemyCourses)
        .set({ stepStartedAt: nowIso() })
        .where(
          and(
            eq(tables.claudemyCourses.id, courseId),
            or(isNull(tables.claudemyCourses.stepStartedAt), lt(tables.claudemyCourses.stepStartedAt, stale))
          )
        )
        .returning({ id: tables.claudemyCourses.id })
      return taken.length > 0
    },

    async releaseStep(courseId: string, error: string) {
      await useDatabase()
        .update(tables.claudemyCourses)
        .set({ stepStartedAt: null, error, updatedAt: nowIso() })
        .where(eq(tables.claudemyCourses.id, courseId))
    },

    async deleteCourse(userId: string, courseId: string) {
      const db = useDatabase()
      const owned = and(eq(tables.claudemyLessons.userId, userId), eq(tables.claudemyLessons.courseId, courseId))
      await db.delete(tables.claudemyLessons).where(owned)
      await db
        .delete(tables.claudemyPages)
        .where(and(eq(tables.claudemyPages.userId, userId), eq(tables.claudemyPages.courseId, courseId)))
      await db
        .delete(tables.claudemyCourses)
        .where(and(eq(tables.claudemyCourses.userId, userId), eq(tables.claudemyCourses.id, courseId)))
    },

    async listPages(courseId: string): Promise<ClaudemyPage[]> {
      const rows = await useDatabase()
        .select()
        .from(tables.claudemyPages)
        .where(eq(tables.claudemyPages.courseId, courseId))
        .orderBy(asc(tables.claudemyPages.seq))
      return rows.map(toPage)
    },

    async addPages(
      userId: string,
      courseId: string,
      pages: { url: string; title: string; kind: string; subtopics: string[] }[]
    ) {
      if (!pages.length) {
        return
      }
      const db = useDatabase()
      const [last] = await db
        .select({ seq: sql<number>`max(${tables.claudemyPages.seq})` })
        .from(tables.claudemyPages)
        .where(eq(tables.claudemyPages.courseId, courseId))
      let seq = Number(last?.seq ?? 0)
      await db.insert(tables.claudemyPages).values(
        pages.map(page => {
          seq += 1
          return {
            id: createId('cpage'),
            userId,
            courseId,
            seq,
            url: page.url,
            title: page.title,
            kind: page.kind,
            subtopics: page.subtopics,
            status: 'pending',
            createdAt: nowIso()
          }
        })
      )
    },

    async updatePage(pageId: string, patch: Partial<Omit<ClaudemyPage, 'id' | 'courseId' | 'userId' | 'seq'>>) {
      await useDatabase()
        .update(tables.claudemyPages)
        .set(patch as Partial<PageRow>)
        .where(eq(tables.claudemyPages.id, pageId))
    },

    async listLessons(courseId: string): Promise<ClaudemyLessonRecord[]> {
      const rows = await useDatabase()
        .select()
        .from(tables.claudemyLessons)
        .where(eq(tables.claudemyLessons.courseId, courseId))
        .orderBy(asc(tables.claudemyLessons.number))
      return rows.map(toLesson)
    },

    async replaceLessons(
      userId: string,
      courseId: string,
      lessons: { number: number; arc: number; handle: string; plan: ClaudemyPlanBlock }[]
    ) {
      const db = useDatabase()
      await db.delete(tables.claudemyLessons).where(eq(tables.claudemyLessons.courseId, courseId))
      await db.insert(tables.claudemyLessons).values(
        lessons.map(lesson => ({
          id: createId('clesson'),
          userId,
          courseId,
          number: lesson.number,
          arc: lesson.arc,
          handle: lesson.handle,
          status: 'planned',
          plan: lesson.plan as unknown as Record<string, unknown>,
          createdAt: nowIso(),
          updatedAt: nowIso()
        }))
      )
    },

    async findLesson(userId: string, lessonId: string): Promise<ClaudemyLessonRecord | null> {
      const [row] = await useDatabase()
        .select()
        .from(tables.claudemyLessons)
        .where(and(eq(tables.claudemyLessons.userId, userId), eq(tables.claudemyLessons.id, lessonId)))
        .limit(1)
      return row ? toLesson(row) : null
    },

    async updateLesson(lessonId: string, patch: Partial<Omit<ClaudemyLessonRecord, 'id' | 'courseId' | 'createdAt'>>) {
      await useDatabase()
        .update(tables.claudemyLessons)
        .set({ ...(patch as Partial<LessonRow>), updatedAt: nowIso() })
        .where(eq(tables.claudemyLessons.id, lessonId))
    },

    async view(userId: string, courseId: string): Promise<ClaudemyCourseView | null> {
      const course = await this.findCourse(userId, courseId)
      if (!course) {
        return null
      }
      const [pages, lessons] = await Promise.all([this.listPages(courseId), this.listLessons(courseId)])
      return { course, pages: pages.map(pageSummary), lessons }
    }
  }
}
