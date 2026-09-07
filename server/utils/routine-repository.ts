import { and, asc, desc, eq } from 'drizzle-orm'
import { format, parseISO } from 'date-fns'
import type { RoutineDay, RoutineEntryRecord, RoutineOverview } from '~~/shared/types/routine'
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
    async listEntries(userId: string): Promise<RoutineEntryRecord[]> {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.routineEntries)
        .where(eq(tables.routineEntries.userId, userId))
        .orderBy(
          desc(tables.routineEntries.entryDate),
          asc(tables.routineEntries.position),
          asc(tables.routineEntries.createdAt)
        )) as RoutineEntryRecord[]
    },

    /** A single day's entries in display order. */
    async listDay(userId: string, entryDate: string): Promise<RoutineEntryRecord[]> {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.routineEntries)
        .where(and(eq(tables.routineEntries.userId, userId), eq(tables.routineEntries.entryDate, entryDate)))
        .orderBy(asc(tables.routineEntries.position), asc(tables.routineEntries.createdAt))) as RoutineEntryRecord[]
    },

    async createEntry(userId: string, input: RoutineEntryInput): Promise<RoutineEntryRecord> {
      const entryDate = input.entryDate || todayKey()
      const siblings = await this.listDay(userId, entryDate)
      const nextPosition = siblings.reduce((max, item) => Math.max(max, item.position), -1) + 1

      const record: RoutineEntryRecord = {
        id: createId('routine'),
        userId,
        description: input.description,
        entryDate,
        state: input.state || 'planned',
        position: nextPosition,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await useDatabase().insert(tables.routineEntries).values(record)
      return record
    },

    /**
     * Swap an entry with its neighbour inside the same day. Positions are renumbered
     * first so days created before this column existed (all zeros) reorder correctly.
     */
    async moveEntry(
      userId: string,
      entryId: string,
      direction: 'up' | 'down'
    ): Promise<RoutineEntryRecord[] | null> {
      const db = useDatabase()
      const [entry] = (await db
        .select()
        .from(tables.routineEntries)
        .where(and(eq(tables.routineEntries.userId, userId), eq(tables.routineEntries.id, entryId)))
        .limit(1)) as RoutineEntryRecord[]

      if (!entry) {
        return null
      }

      const day = await this.listDay(userId, entry.entryDate)
      const index = day.findIndex(item => item.id === entryId)
      const targetIndex = direction === 'up' ? index - 1 : index + 1

      if (index === -1 || targetIndex < 0 || targetIndex >= day.length) {
        return day
      }

      const reordered = [...day]
      const [moved] = reordered.splice(index, 1)
      reordered.splice(targetIndex, 0, moved!)

      const timestamp = nowIso()
      for (const [position, item] of reordered.entries()) {
        if (item.position !== position) {
          await db
            .update(tables.routineEntries)
            .set({ position, updatedAt: timestamp })
            .where(eq(tables.routineEntries.id, item.id))
        }
      }

      return reordered.map((item, position) => ({ ...item, position }))
    },

    async updateEntry(
      userId: string,
      entryId: string,
      patch: RoutineEntryPatch
    ): Promise<RoutineEntryRecord | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.routineEntries)
        .where(and(eq(tables.routineEntries.userId, userId), eq(tables.routineEntries.id, entryId)))
        .limit(1)) as RoutineEntryRecord[]

      if (!record) {
        return null
      }

      const updated: RoutineEntryRecord = { ...record, ...patch, updatedAt: nowIso() }
      await db
        .update(tables.routineEntries)
        .set({
          description: updated.description,
          entryDate: updated.entryDate,
          state: updated.state,
          updatedAt: updated.updatedAt
        })
        .where(eq(tables.routineEntries.id, entryId))

      return updated
    },

    async deleteEntry(userId: string, entryId: string): Promise<RoutineEntryRecord | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.routineEntries)
        .where(and(eq(tables.routineEntries.userId, userId), eq(tables.routineEntries.id, entryId)))
        .limit(1)) as RoutineEntryRecord[]

      if (!record) {
        return null
      }

      await db.delete(tables.routineEntries).where(eq(tables.routineEntries.id, entryId))
      return record
    },

    async getOverview(userId: string): Promise<RoutineOverview> {
      const entries = await this.listEntries(userId)
      const today = todayKey()

      const byDay = new Map<string, RoutineEntryRecord[]>()
      for (const entry of entries) {
        const bucket = byDay.get(entry.entryDate)
        if (bucket) {
          bucket.push(entry)
        } else {
          byDay.set(entry.entryDate, [entry])
        }
      }

      // Newest first, capped — this list is the history view.
      const history: RoutineDay[] = [...byDay.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, HISTORY_DAYS)
        .map(([entryDate, dayEntries]) => ({
          entryDate,
          label: dayLabel(entryDate),
          isToday: entryDate === today,
          entries: dayEntries,
          doneCount: dayEntries.filter(item => item.state === 'done').length,
          totalCount: dayEntries.length
        }))

      const doneCount = entries.filter(entry => entry.state === 'done').length

      // Consecutive days ending today (or yesterday, if today is not logged yet)
      // where every entry for that day was completed.
      const fullyDone = new Set(
        [...byDay.entries()]
          .filter(([, dayEntries]) => dayEntries.length > 0 && dayEntries.every(item => item.state === 'done'))
          .map(([entryDate]) => entryDate)
      )

      let streakDays = 0
      const reference = parseISO(today)
      for (let offset = fullyDone.has(today) ? 0 : 1; offset < 365; offset += 1) {
        const key = format(new Date(reference.getTime() - offset * 86_400_000), 'yyyy-MM-dd')
        if (fullyDone.has(key)) {
          streakDays += 1
        } else {
          break
        }
      }

      return {
        today,
        todayEntries: byDay.get(today) || [],
        history,
        totalEntries: entries.length,
        doneCount,
        completionRate: entries.length === 0 ? 0 : Math.round((doneCount / entries.length) * 100),
        streakDays
      }
    }
  }
}

