import type Anthropic from '@anthropic-ai/sdk'
import { and, desc, eq } from 'drizzle-orm'
import type {
  FundamentalSnapshot,
  TechnicalSnapshot,
  TickerReviewRecord
} from '~~/shared/types/ticker'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'
import { CLAUDE_MODEL, useAnthropic } from '~~/server/utils/anthropic-client'
import { fetchFundamental, fetchTechnical } from '~~/server/utils/ticker-analysis'

const HISTORY_LIMIT = 50

/**
 * The brief deliberately asks for the bear case and for uncertainty to be named.
 * A review that only lists positives is worse than no review.
 */
const SYSTEM_PROMPT = `You are writing a blunt, even-handed assessment of a listed company for one private investor who tracks their own portfolio.

You will be given computed technical indicators and fundamental figures taken from the company's own SEC filings. Work only from those numbers plus what you already know about the business. Never invent a figure that is not provided.

Write in this structure, using these exact markdown headings:
## The read
## What the technicals say
## What the fundamentals say
## The bear case
## What would change my mind

Rules:
- Be honest and specific. If the numbers are mediocre, say so plainly.
- The bear case section is mandatory and must be genuine, not a token caveat.
- Name what the data does not tell you. If fundamentals are missing, say the read is thinner because of it.
- Quote the actual numbers you are reasoning from.
- No price targets, no buy/sell/hold rating, no position sizing.
- Under 450 words. No preamble, start at the first heading.`

function buildPrompt(
  symbol: string,
  companyName: string,
  technical: TechnicalSnapshot,
  fundamental: FundamentalSnapshot
) {
  const money = (value: number | null) =>
    value === null ? 'n/a' : `${(value / 1e9).toFixed(2)}B ${technical.currency}`

  const lines = [
    `Company: ${companyName} (${symbol.toUpperCase()})`,
    `Price: ${technical.price} ${technical.currency} as of ${technical.asOf.slice(0, 10)}`,
    '',
    'TECHNICAL:',
    `- 20/50/200-day averages: ${technical.sma20 ?? 'n/a'} / ${technical.sma50 ?? 'n/a'} / ${technical.sma200 ?? 'n/a'}`,
    `- RSI(14): ${technical.rsi14 ?? 'n/a'}`,
    `- 52-week range: ${technical.low52w ?? 'n/a'} to ${technical.high52w ?? 'n/a'} (currently ${technical.rangePosition ?? 'n/a'}% up that range)`,
    `- Returns 1m/3m/6m/12m: ${technical.return1m ?? 'n/a'}% / ${technical.return3m ?? 'n/a'}% / ${technical.return6m ?? 'n/a'}% / ${technical.return12m ?? 'n/a'}%`,
    `- Annualised volatility: ${technical.volatility ?? 'n/a'}%`,
    ''
  ]

  if (fundamental.available) {
    lines.push(
      `FUNDAMENTAL (${fundamental.fiscalPeriod || 'latest annual filing'}, source ${fundamental.source}):`,
      `- Revenue: ${money(fundamental.revenue)} (growth ${fundamental.revenueGrowthPercent ?? 'n/a'}% YoY)`,
      `- Operating income: ${money(fundamental.operatingIncome)} (margin ${fundamental.operatingMarginPercent ?? 'n/a'}%)`,
      `- Net income: ${money(fundamental.netIncome)} (margin ${fundamental.netMarginPercent ?? 'n/a'}%)`,
      `- Assets / liabilities / equity: ${money(fundamental.assets)} / ${money(fundamental.liabilities)} / ${money(fundamental.equity)}`,
      `- Liabilities to equity: ${fundamental.debtToEquity ?? 'n/a'}`,
      `- Return on equity: ${fundamental.returnOnEquityPercent ?? 'n/a'}%`,
      `- Market cap: ${money(fundamental.marketCap)}, P/E ${fundamental.peRatio ?? 'n/a'}`
    )
  } else {
    lines.push(`FUNDAMENTAL: unavailable. ${fundamental.note}`)
  }

  return lines.join('\n')
}

async function writeReview(
  symbol: string,
  companyName: string,
  technical: TechnicalSnapshot,
  fundamental: FundamentalSnapshot
): Promise<{ review: string; reviewError: string }> {
  try {
    const message = await useAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(symbol, companyName, technical, fundamental) }]
    })

    const review = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim()

    return { review, reviewError: review ? '' : 'Claude returned an empty response.' }
  } catch (error) {
    // The metrics are the substance; a missing narrative must not fail the request.
    const statusMessage =
      error && typeof error === 'object' && 'statusMessage' in error
        ? String((error as { statusMessage?: string }).statusMessage)
        : null

    return {
      review: '',
      reviewError:
        statusMessage ||
        (error instanceof Error ? error.message : 'Claude could not be reached for the written review.')
    }
  }
}

function hydrate(row: typeof tables.tickerReviews.$inferSelect): TickerReviewRecord {
  return {
    ...row,
    technical: row.technical as unknown as TechnicalSnapshot,
    fundamental: row.fundamental as unknown as FundamentalSnapshot
  }
}

export function useTickerRepository() {
  return {
    async listReviews(userId: string): Promise<TickerReviewRecord[]> {
      const rows = await useDatabase()
        .select()
        .from(tables.tickerReviews)
        .where(eq(tables.tickerReviews.userId, userId))
        .orderBy(desc(tables.tickerReviews.createdAt))
        .limit(HISTORY_LIMIT)

      return rows.map(hydrate)
    },

    async createReview(userId: string, rawSymbol: string): Promise<TickerReviewRecord> {
      const symbol = rawSymbol.trim().toUpperCase()

      const { technical, companyName } = await fetchTechnical(symbol)
      const fundamental = await fetchFundamental(symbol, technical.price)
      const { review, reviewError } = await writeReview(symbol, companyName, technical, fundamental)

      const record: TickerReviewRecord = {
        id: createId('review'),
        userId,
        symbol,
        companyName,
        technical,
        fundamental,
        review,
        reviewError,
        createdAt: new Date().toISOString()
      }

      await useDatabase()
        .insert(tables.tickerReviews)
        .values({
          ...record,
          technical: technical as unknown as Record<string, unknown>,
          fundamental: fundamental as unknown as Record<string, unknown>
        })

      return record
    },

    async deleteReview(userId: string, reviewId: string) {
      const db = useDatabase()
      const [row] = await db
        .select()
        .from(tables.tickerReviews)
        .where(and(eq(tables.tickerReviews.userId, userId), eq(tables.tickerReviews.id, reviewId)))
        .limit(1)

      if (!row) {
        return null
      }

      await db.delete(tables.tickerReviews).where(eq(tables.tickerReviews.id, reviewId))
      return hydrate(row)
    }
  }
}
