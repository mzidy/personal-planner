import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { format, parseISO } from 'date-fns'
import type {
  RoutineDay,
  RoutineDayItem,
  RoutineOverview,
  RoutineState,
  RoutineTemplateRecord
} from '~~/shared/types/routine'
import type { RoutineEntryInput, RoutineEntryPatch } from '~~/shared/schemas/routine'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

const HISTORY_DAYS = 30

function nowIso() {
  return new Date().toISOString()
}

function todayKey() {
  return format(new Date(), 'yyyy-MM-dd')
}

function dayLabel(entryDate: string) {
  return format(parseISO(entryDate), 'EEEE, MMMM d')
}

export function useRoutineRepository() {
  return {
    /** Active routine items in display order. */
    async listTemplates(userId: string): Promise<RoutineTemplateRecord[]> {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.routineTemplates)
        .where(and(eq(tables.routineTemplates.userId, userId), isNull(tables.routineTemplates.archivedAt)))
        .orderBy(asc(tables.routineTemplates.position), asc(tables.routineTemplates.createdAt))) as RoutineTemplateRecord[]
    },

    async createTemplate(userId: string, input: RoutineEntryInput): Promise<RoutineTemplateRecord> {
      const siblings = await this.listTemplates(userId)
      const record: RoutineTemplateRecord = {
        id: createId('routine'),
        userId,
        description: input.description,
        position: siblings.reduce((max, item) => Math.max(max, item.position), -1) + 1,
        archivedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await useDatabase().insert(tables.routineTemplates).values(record)

      // A state supplied at creation applies to the day it was created for.
      if (input.state && input.state !== 'planned') {
        await this.setState(userId, record.id, input.entryDate || todayKey(), input.state)
      }

      return record
    },

    async updateTemplate(
      userId: string,
      templateId: string,
      patch: RoutineEntryPatch
    ): Promise<RoutineTemplateRecord | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.routineTemplates)
        .where(and(eq(tables.routineTemplates.userId, userId), eq(tables.routineTemplates.id, templateId)))
        .limit(1)) as RoutineTemplateRecord[]

      if (!record) {
        return null
      }

      // `state` on a patch is a per-day value, never part of the definition.
      if (patch.state) {
        await this.setState(userId, templateId, patch.entryDate || todayKey(), patch.state)
      }

      if (patch.description === undefined) {
        return record
      }

      const updated = { ...record, description: patch.description, updatedAt: nowIso() }
      await db
        .update(tables.routineTemplates)
        .set({ description: updated.description, updatedAt: updated.updatedAt })
        .where(eq(tables.routineTemplates.id, templateId))
      return updated
    },

    /** Retire an item from future days; recorded history keeps it. */
    async archiveTemplate(userId: string, templateId: string): Promise<RoutineTemplateRecord | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.routineTemplates)
        .where(and(eq(tables.routineTemplates.userId, userId), eq(tables.routineTemplates.id, templateId)))
        .limit(1)) as RoutineTemplateRecord[]

      if (!record) {
        return null
      }

      const archivedAt = nowIso()
      await db
        .update(tables.routineTemplates)
        .set({ archivedAt, updatedAt: archivedAt })
        .where(eq(tables.routineTemplates.id, templateId))
      return { ...record, archivedAt }
    },

    async moveTemplate(
      userId: string,
      templateId: string,
      direction: 'up' | 'down'
    ): Promise<RoutineTemplateRecord[] | null> {
      const db = useDatabase()
      const templates = await this.listTemplates(userId)
      const index = templates.findIndex(item => item.id === templateId)

      if (index === -1) {
        return null
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= templates.length) {
        return templates
      }

      const reordered = [...templates]
      const [moved] = reordered.splice(index, 1)
      reordered.splice(targetIndex, 0, moved!)

      const timestamp = nowIso()
      for (const [position, item] of reordered.entries()) {
        if (item.position !== position) {
          await db
            .update(tables.routineTemplates)
            .set({ position, updatedAt: timestamp })
            .where(eq(tables.routineTemplates.id, item.id))
        }
      }

      return reordered.map((item, position) => ({ ...item, position }))
    },

    /** Upsert one item's state for one day. */
    async setState(userId: string, templateId: string, entryDate: string, state: RoutineState) {
      const db = useDatabase()
      const [existing] = await db
        .select()
        .from(tables.routineDayStates)
        .where(
          and(
            eq(tables.routineDayStates.userId, userId),
            eq(tables.routineDayStates.templateId, templateId),
            eq(tables.routineDayStates.entryDate, entryDate)
          )
        )
        .limit(1)

      const timestamp = nowIso()

      if (existing) {
        await db
          .update(tables.routineDayStates)
          .set({ state, updatedAt: timestamp })
          .where(eq(tables.routineDayStates.id, existing.id))
        return
      }

      await db.insert(tables.routineDayStates).values({
        id: createId('rstate'),
        userId,
        templateId,
        entryDate,
        state,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    },

    async getOverview(userId: string): Promise<RoutineOverview> {
      const db = useDatabase()
      const today = todayKey()
      const templates = await this.listTemplates(userId)

      const states = await db
        .select()
        .from(tables.routineDayStates)
        .where(eq(tables.routineDayStates.userId, userId))
        .orderBy(desc(tables.routineDayStates.entryDate))

      const stateFor = new Map(states.map(row => [`${row.entryDate}|${row.templateId}`, row.state as RoutineState]))

      const todayItems: RoutineDayItem[] = templates.map(template => ({
        id: template.id,
        templateId: template.id,
        description: template.description,
        position: template.position,
        state: stateFor.get(`${today}|${template.id}`) || 'planned'
      }))

      // History covers past days that have at least one recorded state. Descriptions
      // come from the template so archived items still read correctly.
      const describe = new Map<string, string>()
      const allTemplates = (await db
        .select()
        .from(tables.routineTemplates)
        .where(eq(tables.routineTemplates.userId, userId))) as RoutineTemplateRecord[]
      for (const template of allTemplates) {
        describe.set(template.id, template.description)
      }

      const byDay = new Map<string, RoutineDayItem[]>()
      for (const row of states) {
        if (row.entryDate === today) {
          continue
        }
        const item: RoutineDayItem = {
          id: row.id,
          templateId: row.templateId,
          description: describe.get(row.templateId) || 'Removed item',
          position: 0,
          state: row.state as RoutineState
        }
        const bucket = byDay.get(row.entryDate)
        if (bucket) {
          bucket.push(item)
        } else {
          byDay.set(row.entryDate, [item])
        }
      }

      const history: RoutineDay[] = [...byDay.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, HISTORY_DAYS)
        .map(([entryDate, items]) => ({
          entryDate,
          label: dayLabel(entryDate),
          isToday: false,
          items,
          doneCount: items.filter(item => item.state === 'done').length,
          totalCount: items.length
        }))

      return { today, todayItems, history }
    }
  }
}
