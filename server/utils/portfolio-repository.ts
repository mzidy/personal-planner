import { and, desc, eq } from 'drizzle-orm'
import { format } from 'date-fns'
import type { PortfolioOverview, PortfolioRuleRecord } from '~~/shared/types/portfolio'
import type { PortfolioRuleInput, PortfolioRulePatch } from '~~/shared/schemas/portfolio'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'
import { useInvestmentsRepository } from '~~/server/utils/investments-repository'

function nowIso() {
  return new Date().toISOString()
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

export function usePortfolioRepository() {
  return {
    async listRules(userId: string): Promise<PortfolioRuleRecord[]> {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.portfolioRules)
        .where(eq(tables.portfolioRules.userId, userId))
        .orderBy(desc(tables.portfolioRules.dateSet), desc(tables.portfolioRules.createdAt))) as PortfolioRuleRecord[]
    },

    async createRule(userId: string, input: PortfolioRuleInput): Promise<PortfolioRuleRecord> {
      const record: PortfolioRuleRecord = {
        id: createId('rule'),
        userId,
        name: input.name,
        description: input.description || '',
        dateSet: input.dateSet || format(new Date(), 'yyyy-MM-dd'),
        isIndex: input.isIndex ?? false,
        geo: input.geo || '',
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await useDatabase().insert(tables.portfolioRules).values(record)
      return record
    },

    async updateRule(
      userId: string,
      ruleId: string,
      patch: PortfolioRulePatch
    ): Promise<PortfolioRuleRecord | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.portfolioRules)
        .where(and(eq(tables.portfolioRules.userId, userId), eq(tables.portfolioRules.id, ruleId)))
        .limit(1)) as PortfolioRuleRecord[]

      if (!record) {
        return null
      }

      const updated: PortfolioRuleRecord = { ...record, ...patch, updatedAt: nowIso() }
      await db
        .update(tables.portfolioRules)
        .set({
          name: updated.name,
          description: updated.description,
          dateSet: updated.dateSet,
          isIndex: updated.isIndex,
          geo: updated.geo,
          updatedAt: updated.updatedAt
        })
        .where(eq(tables.portfolioRules.id, ruleId))

      return updated
    },

    async deleteRule(userId: string, ruleId: string): Promise<PortfolioRuleRecord | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.portfolioRules)
        .where(and(eq(tables.portfolioRules.userId, userId), eq(tables.portfolioRules.id, ruleId)))
        .limit(1)) as PortfolioRuleRecord[]

      if (!record) {
        return null
      }

      await db.delete(tables.portfolioRules).where(eq(tables.portfolioRules.id, ruleId))
      return record
    },

    async getOverview(userId: string): Promise<PortfolioOverview> {
      const [rules, positions] = await Promise.all([
        this.listRules(userId),
        // The portfolio is the existing investment holdings; rules will be
        // evaluated against these once the checks are defined.
        useInvestmentsRepository().listPositions(userId)
      ])

      return {
        rules,
        positions,
        invested: round(positions.reduce((sum, item) => sum + item.invested, 0)),
        marketValue: round(positions.reduce((sum, item) => sum + item.marketValue, 0))
      }
    }
  }
}
