import { and, desc, eq } from 'drizzle-orm'
import type { HabitPlanRecord, HabitPlanStatus } from '~~/shared/types/habit'
import type { HabitPlanInput, HabitPlanPatch } from '~~/shared/schemas/habit'
import { habitPlanTitle } from '~~/shared/utils/habit-wizard'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

function nowIso() {
  return new Date().toISOString()
}

function hydrate(row: typeof tables.habitPlans.$inferSelect): HabitPlanRecord {
  return {
    ...row,
    answers: (row.answers || {}) as Record<string, string>,
    status: row.status as HabitPlanStatus
  }
}

/** Blank answers are dropped so a half-finished draft does not store empty keys. */
function pruned(answers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(answers)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value)
  ) as Record<string, string>
}

export function useHabitRepository() {
  return {
    async listPlans(userId: string): Promise<HabitPlanRecord[]> {
      const rows = await useDatabase()
        .select()
        .from(tables.habitPlans)
        .where(eq(tables.habitPlans.userId, userId))
        .orderBy(desc(tables.habitPlans.updatedAt))

      return rows.map(hydrate)
    },

    async createPlan(userId: string, input: HabitPlanInput): Promise<HabitPlanRecord> {
      const answers = pruned(input.answers)
      const timestamp = nowIso()

      const record: HabitPlanRecord = {
        id: createId('habit'),
        userId,
        title: habitPlanTitle(answers),
        answers,
        status: input.status || 'draft',
        createdAt: timestamp,
        updatedAt: timestamp
      }

      await useDatabase().insert(tables.habitPlans).values(record)
      return record
    },

    async updatePlan(
      userId: string,
      planId: string,
      patch: HabitPlanPatch
    ): Promise<HabitPlanRecord | null> {
      const db = useDatabase()
      const [row] = await db
        .select()
        .from(tables.habitPlans)
        .where(and(eq(tables.habitPlans.userId, userId), eq(tables.habitPlans.id, planId)))
        .limit(1)

      if (!row) {
        return null
      }

      const existing = hydrate(row)
      const answers = patch.answers ? pruned(patch.answers) : existing.answers
      const updated: HabitPlanRecord = {
        ...existing,
        answers,
        title: habitPlanTitle(answers),
        status: patch.status || existing.status,
        updatedAt: nowIso()
      }

      await db
        .update(tables.habitPlans)
        .set({
          answers: updated.answers,
          title: updated.title,
          status: updated.status,
          updatedAt: updated.updatedAt
        })
        .where(eq(tables.habitPlans.id, planId))

      return updated
    },

    async deletePlan(userId: string, planId: string): Promise<HabitPlanRecord | null> {
      const db = useDatabase()
      const [row] = await db
        .select()
        .from(tables.habitPlans)
        .where(and(eq(tables.habitPlans.userId, userId), eq(tables.habitPlans.id, planId)))
        .limit(1)

      if (!row) {
        return null
      }

      await db.delete(tables.habitPlans).where(eq(tables.habitPlans.id, planId))
      return hydrate(row)
    }
  }
}
