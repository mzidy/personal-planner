import { eq } from 'drizzle-orm'
import type { SavingsGoalInput } from '~~/shared/schemas/savings'
import type { SavingsGoalRecord } from '~~/shared/types/savings'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

function toRecord(row: typeof tables.savingsGoals.$inferSelect): SavingsGoalRecord {
  return {
    id: row.id,
    title: row.title,
    targetAmount: row.targetAmount,
    savedAmount: row.savedAmount,
    weeklyAllowance: row.weeklyAllowance,
    updatedAt: row.updatedAt
  }
}

export function useSavingsRepository() {
  return {
    async find(userId: string): Promise<SavingsGoalRecord | null> {
      const [row] = await useDatabase().select().from(tables.savingsGoals).where(eq(tables.savingsGoals.userId, userId)).limit(1)
      return row ? toRecord(row) : null
    },

    /** Each user has one goal; saving replaces it. */
    async save(userId: string, input: SavingsGoalInput): Promise<SavingsGoalRecord> {
      const now = new Date().toISOString()
      const db = useDatabase()
      const [existing] = await db.select({ id: tables.savingsGoals.id }).from(tables.savingsGoals).where(eq(tables.savingsGoals.userId, userId)).limit(1)
      if (existing) {
        await db
          .update(tables.savingsGoals)
          .set({ ...input, updatedAt: now })
          .where(eq(tables.savingsGoals.userId, userId))
      } else {
        await db.insert(tables.savingsGoals).values({ id: createId('save'), userId, ...input, createdAt: now, updatedAt: now })
      }
      return (await this.find(userId))!
    }
  }
}
