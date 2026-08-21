import { and, asc, eq } from 'drizzle-orm'
import type {
  InvestmentGroup,
  InvestmentKind,
  InvestmentPositionRecord,
  InvestmentTotals,
  InvestmentsOverview,
  PositionWithMetrics
} from '~~/shared/types/investments'
import type { InvestmentPositionInput, InvestmentPositionPatch } from '~~/shared/schemas/investments'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

const KINDS: { kind: InvestmentKind; label: string; blurb: string }[] = [
  { kind: 'etf', label: 'ETF', blurb: 'Index and sector funds held for the long run.' },
  { kind: 'stock', label: 'Stocks', blurb: 'Individual company shares.' },
  { kind: 'option', label: 'Options', blurb: 'Calls and puts, priced per contract.' }
]

const DEFAULT_CONTRACT_SIZE = 100

function nowIso() {
  return new Date().toISOString()
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Options are quoted per share but traded per contract, so contracts scale by contractSize. */
function multiplierFor(position: InvestmentPositionRecord) {
  return position.kind === 'option' ? position.contractSize ?? DEFAULT_CONTRACT_SIZE : 1
}

export function withMetrics(position: InvestmentPositionRecord): PositionWithMetrics {
  const multiplier = multiplierFor(position)
  const priced = position.currentPrice !== null
  const effectivePrice = position.currentPrice ?? position.unitCost

  const invested = round(position.quantity * position.unitCost * multiplier)
  const marketValue = round(position.quantity * effectivePrice * multiplier)
  const profitLoss = round(marketValue - invested)
  const profitLossPercent = invested === 0 ? 0 : round((profitLoss / invested) * 100)

  return { ...position, multiplier, invested, marketValue, profitLoss, profitLossPercent, priced }
}

function totalsOf(positions: PositionWithMetrics[]): InvestmentTotals {
  const invested = round(positions.reduce((sum, item) => sum + item.invested, 0))
  const marketValue = round(positions.reduce((sum, item) => sum + item.marketValue, 0))
  const profitLoss = round(marketValue - invested)

  return {
    positionCount: positions.length,
    invested,
    marketValue,
    profitLoss,
    profitLossPercent: invested === 0 ? 0 : round((profitLoss / invested) * 100)
  }
}

export function useInvestmentsRepository() {
  return {
    async listPositions(userId: string, kind?: InvestmentKind): Promise<PositionWithMetrics[]> {
      const db = useDatabase()
      const where = kind
        ? and(eq(tables.investmentPositions.userId, userId), eq(tables.investmentPositions.kind, kind))
        : eq(tables.investmentPositions.userId, userId)

      const rows = (await db
        .select()
        .from(tables.investmentPositions)
        .where(where)
        .orderBy(asc(tables.investmentPositions.symbol))) as InvestmentPositionRecord[]

      return rows.map(withMetrics)
    },

    async createPosition(userId: string, input: InvestmentPositionInput): Promise<PositionWithMetrics> {
      const record: InvestmentPositionRecord = {
        id: createId('pos'),
        userId,
        kind: input.kind,
        symbol: input.symbol.toUpperCase(),
        name: input.name || '',
        quantity: input.quantity,
        unitCost: input.unitCost,
        currentPrice: input.currentPrice ?? null,
        currency: (input.currency || 'USD').toUpperCase(),
        notes: input.notes || '',
        openedAt: input.openedAt || null,
        optionType: input.kind === 'option' ? input.optionType ?? null : null,
        strike: input.kind === 'option' ? input.strike ?? null : null,
        expiry: input.kind === 'option' ? input.expiry ?? null : null,
        contractSize: input.kind === 'option' ? input.contractSize ?? DEFAULT_CONTRACT_SIZE : null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }

      await useDatabase().insert(tables.investmentPositions).values(record)
      return withMetrics(record)
    },

    async updatePosition(
      userId: string,
      positionId: string,
      patch: InvestmentPositionPatch
    ): Promise<PositionWithMetrics | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.investmentPositions)
        .where(and(eq(tables.investmentPositions.userId, userId), eq(tables.investmentPositions.id, positionId)))
        .limit(1)) as InvestmentPositionRecord[]

      if (!record) {
        return null
      }

      const updated: InvestmentPositionRecord = {
        ...record,
        ...patch,
        symbol: patch.symbol ? patch.symbol.toUpperCase() : record.symbol,
        currentPrice: patch.currentPrice === undefined ? record.currentPrice : patch.currentPrice,
        updatedAt: nowIso()
      }

      await db
        .update(tables.investmentPositions)
        .set({
          symbol: updated.symbol,
          name: updated.name,
          quantity: updated.quantity,
          unitCost: updated.unitCost,
          currentPrice: updated.currentPrice,
          notes: updated.notes,
          optionType: updated.optionType,
          strike: updated.strike,
          expiry: updated.expiry,
          contractSize: updated.contractSize,
          updatedAt: updated.updatedAt
        })
        .where(eq(tables.investmentPositions.id, positionId))

      return withMetrics(updated)
    },

    async deletePosition(userId: string, positionId: string): Promise<InvestmentPositionRecord | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.investmentPositions)
        .where(and(eq(tables.investmentPositions.userId, userId), eq(tables.investmentPositions.id, positionId)))
        .limit(1)) as InvestmentPositionRecord[]

      if (!record) {
        return null
      }

      await db.delete(tables.investmentPositions).where(eq(tables.investmentPositions.id, positionId))
      return record
    },

    async getOverview(userId: string): Promise<InvestmentsOverview> {
      const positions = await this.listPositions(userId)

      const groups: InvestmentGroup[] = KINDS.map(meta => {
        const groupPositions = positions.filter(item => item.kind === meta.kind)
        return { ...meta, positions: groupPositions, ...totalsOf(groupPositions) }
      })

      return { groups, totals: totalsOf(positions) }
    }
  }
}
