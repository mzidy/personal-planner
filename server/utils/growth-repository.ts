import { and, eq } from 'drizzle-orm'
import type { GrowthAnswerRecord, GrowthOverview, GrowthStepState } from '~~/shared/types/growth'
import type { GrowthAnswerInput } from '~~/shared/schemas/growth'
import { GROWTH_STEPS } from '~~/shared/utils/growth-steps'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

function nowIso() {
  return new Date().toISOString()
}

export function useGrowthRepository() {
  return {
    async listAnswers(userId: string): Promise<GrowthAnswerRecord[]> {
      return (await useDatabase()
        .select()
        .from(tables.growthAnswers)
        .where(eq(tables.growthAnswers.userId, userId))) as GrowthAnswerRecord[]
    },

    /** Writing an empty answer clears the step rather than storing a blank row. */
    async saveAnswer(userId: string, input: GrowthAnswerInput): Promise<GrowthAnswerRecord | null> {
      const db = useDatabase()
      const answer = input.answer.trim()
      const timestamp = nowIso()

      const [existing] = (await db
        .select()
        .from(tables.growthAnswers)
        .where(
          and(eq(tables.growthAnswers.userId, userId), eq(tables.growthAnswers.stepKey, input.stepKey))
        )
        .limit(1)) as GrowthAnswerRecord[]

      if (!answer) {
        if (existing) {
          await db.delete(tables.growthAnswers).where(eq(tables.growthAnswers.id, existing.id))
        }
        return null
      }

      if (existing) {
        await db
          .update(tables.growthAnswers)
          .set({ answer, updatedAt: timestamp })
          .where(eq(tables.growthAnswers.id, existing.id))
        return { ...existing, answer, updatedAt: timestamp }
      }

      const record: GrowthAnswerRecord = {
        id: createId('growth'),
        userId,
        stepKey: input.stepKey,
        answer,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      await db.insert(tables.growthAnswers).values(record)
      return record
    },

    async getOverview(userId: string): Promise<GrowthOverview> {
      const answers = await this.listAnswers(userId)
      const byStep = new Map(answers.map(item => [item.stepKey, item]))

      // Driven by GROWTH_STEPS, so a new prompt appears immediately and a row
      // left behind by a removed prompt is simply ignored.
      const steps: GrowthStepState[] = GROWTH_STEPS.map(step => {
        const record = byStep.get(step.key)
        return {
          ...step,
          answer: record?.answer || '',
          answeredAt: record?.updatedAt || null
        }
      })

      return {
        steps,
        answeredCount: steps.filter(step => step.answer).length,
        totalCount: steps.length
      }
    }
  }
}
