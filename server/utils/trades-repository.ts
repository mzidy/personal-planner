import { and, desc, eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { z } from 'zod'
import type { ExchangeInput, TradeInput } from '~~/shared/schemas/trades'
import type { ExchangeView, OpenTradeRecord, StockExchangeRecord, TradeView, TradesView } from '~~/shared/types/trades'
import type { WatchlistQuote } from '~~/shared/types/watchlist'
import { exchangeResult, exchangeStats, isoDay, tradeResult, tradeStats } from '~~/shared/utils/trades'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'
import { fetchWatchlistQuote } from '~~/server/utils/watchlist-quotes'

/** Per list; far more than anyone keeps by hand, low enough to price in one request. */
export const TRADES_LIMIT = 500

type ExchangeRow = typeof tables.stockExchanges.$inferSelect
type TradeRow = typeof tables.stockTrades.$inferSelect

/** Validates a request body, answering 400 with the first problem in plain words. */
export async function readTradeBody<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Those details are not valid.' })
  }
  return parsed.data
}

function toExchange(row: ExchangeRow): StockExchangeRecord {
  return {
    id: row.id,
    sold: {
      symbol: row.soldSymbol,
      name: row.soldName,
      currency: row.soldCurrency,
      price: row.soldPrice,
      date: row.soldDate,
      quantity: row.soldQuantity
    },
    bought: {
      symbol: row.boughtSymbol,
      name: row.boughtName,
      currency: row.boughtCurrency,
      price: row.boughtPrice,
      date: row.boughtDate,
      quantity: row.boughtQuantity
    },
    note: row.note,
    closedDate: row.closedDate,
    closedBoughtPrice: row.closedBoughtPrice,
    closedSoldPrice: row.closedSoldPrice,
    createdAt: row.createdAt
  }
}

function toTrade(row: TradeRow): OpenTradeRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    currency: row.currency,
    quantity: row.quantity,
    entryPrice: row.entryPrice,
    entryDate: row.entryDate,
    targetPrice: row.targetPrice,
    stopPrice: row.stopPrice,
    note: row.note,
    exitPrice: row.exitPrice,
    exitDate: row.exitDate,
    createdAt: row.createdAt
  }
}

function quoteFailure(reason: unknown) {
  return (reason as { statusMessage?: string })?.statusMessage || 'Price unavailable right now.'
}

/**
 * Name and currency for a ticker, which also proves Yahoo knows it. An edit
 * that keeps the ticker keeps what was stored, so it does not depend on Yahoo.
 */
async function describe(symbol: string, stored?: { symbol: string; name: string; currency: string }) {
  if (stored && stored.symbol === symbol) {
    return { name: stored.name, currency: stored.currency }
  }
  const quote = await fetchWatchlistQuote(symbol)
  return { name: quote.name, currency: quote.currency }
}

export function useTradesRepository() {
  async function exchangeRows(userId: string) {
    return useDatabase()
      .select()
      .from(tables.stockExchanges)
      .where(eq(tables.stockExchanges.userId, userId))
      .orderBy(desc(tables.stockExchanges.boughtDate), desc(tables.stockExchanges.createdAt))
  }

  async function tradeRows(userId: string) {
    return useDatabase()
      .select()
      .from(tables.stockTrades)
      .where(eq(tables.stockTrades.userId, userId))
      .orderBy(desc(tables.stockTrades.entryDate), desc(tables.stockTrades.createdAt))
  }

  async function findExchange(userId: string, id: string) {
    const [row] = await useDatabase()
      .select()
      .from(tables.stockExchanges)
      .where(and(eq(tables.stockExchanges.userId, userId), eq(tables.stockExchanges.id, id)))
      .limit(1)
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'That exchange no longer exists.' })
    }
    return row
  }

  async function findTrade(userId: string, id: string) {
    const [row] = await useDatabase()
      .select()
      .from(tables.stockTrades)
      .where(and(eq(tables.stockTrades.userId, userId), eq(tables.stockTrades.id, id)))
      .limit(1)
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'That trade no longer exists.' })
    }
    return row
  }

  async function assertRoom(table: typeof tables.stockExchanges | typeof tables.stockTrades, userId: string) {
    const [counted] = await useDatabase().select({ count: sql<number>`count(*)` }).from(table).where(eq(table.userId, userId))
    if (Number(counted?.count ?? 0) >= TRADES_LIMIT) {
      throw createError({ statusCode: 409, statusMessage: `Each list holds up to ${TRADES_LIMIT} entries.` })
    }
  }

  async function exchangeColumns(input: ExchangeInput, stored?: ExchangeRow) {
    const [sold, bought] = await Promise.all([
      describe(input.sold.symbol, stored && { symbol: stored.soldSymbol, name: stored.soldName, currency: stored.soldCurrency }),
      describe(input.bought.symbol, stored && { symbol: stored.boughtSymbol, name: stored.boughtName, currency: stored.boughtCurrency })
    ])
    return {
      soldSymbol: input.sold.symbol,
      soldName: sold.name,
      soldCurrency: sold.currency,
      soldPrice: input.sold.price,
      soldDate: input.sold.date,
      soldQuantity: input.sold.quantity,
      boughtSymbol: input.bought.symbol,
      boughtName: bought.name,
      boughtCurrency: bought.currency,
      boughtPrice: input.bought.price,
      boughtDate: input.bought.date,
      boughtQuantity: input.bought.quantity,
      note: input.note,
      closedDate: input.closedDate,
      closedBoughtPrice: input.closedBoughtPrice,
      closedSoldPrice: input.closedSoldPrice,
      updatedAt: new Date().toISOString()
    }
  }

  async function tradeColumns(input: TradeInput, stored?: TradeRow) {
    const described = await describe(input.symbol, stored)
    return { ...input, ...described, updatedAt: new Date().toISOString() }
  }

  return {
    /**
     * Both lists, each active entry priced live. Closed entries use their
     * frozen prices, so history needs no quotes and never goes stale; one
     * ticker failing leaves that entry without a result and the rest intact.
     */
    async view(userId: string): Promise<TradesView> {
      const [exchanges, trades] = await Promise.all([
        exchangeRows(userId).then(rows => rows.map(toExchange)),
        tradeRows(userId).then(rows => rows.map(toTrade))
      ])

      const symbols = new Set<string>()
      for (const exchange of exchanges.filter(entry => entry.closedDate === null)) {
        symbols.add(exchange.sold.symbol)
        symbols.add(exchange.bought.symbol)
      }
      for (const trade of trades.filter(entry => entry.exitPrice === null)) {
        symbols.add(trade.symbol)
      }
      const priced = [...symbols]
      const settled = await Promise.allSettled(priced.map(symbol => fetchWatchlistQuote(symbol)))
      const quotes = new Map<string, PromiseSettledResult<WatchlistQuote>>(priced.map((symbol, index) => [symbol, settled[index]!]))

      const live = (symbol: string) => {
        const quote = quotes.get(symbol)
        if (quote?.status === 'fulfilled' && quote.value.price !== null) {
          return { price: quote.value.price, error: '' }
        }
        return { price: null, error: quote?.status === 'rejected' ? quoteFailure(quote.reason) : `No price for ${symbol} right now.` }
      }

      const today = isoDay()
      const exchangeViews: ExchangeView[] = exchanges.map(exchange => {
        if (exchange.closedDate !== null) {
          const soldNow = exchange.closedSoldPrice!
          const boughtNow = exchange.closedBoughtPrice!
          return { ...exchange, soldNow, boughtNow, result: exchangeResult(exchange, soldNow, boughtNow, today), quoteError: '' }
        }
        const sold = live(exchange.sold.symbol)
        const bought = live(exchange.bought.symbol)
        const result = sold.price !== null && bought.price !== null ? exchangeResult(exchange, sold.price, bought.price, today) : null
        return { ...exchange, soldNow: sold.price, boughtNow: bought.price, result, quoteError: sold.error || bought.error }
      })

      const tradeViews: TradeView[] = trades.map(trade => {
        if (trade.exitPrice !== null) {
          return { ...trade, now: trade.exitPrice, result: tradeResult(trade, trade.exitPrice, today), quoteError: '' }
        }
        const { price, error } = live(trade.symbol)
        return { ...trade, now: price, result: price === null ? null : tradeResult(trade, price, today), quoteError: error }
      })

      return {
        exchanges: exchangeViews,
        trades: tradeViews,
        stats: { exchanges: exchangeStats(exchangeViews), trades: tradeStats(tradeViews) },
        marketOpen: [...quotes.values()].some(quote => quote.status === 'fulfilled' && quote.value.marketOpen),
        fetchedAt: new Date().toISOString()
      }
    },

    async addExchange(userId: string, input: ExchangeInput) {
      await assertRoom(tables.stockExchanges, userId)
      const now = new Date().toISOString()
      await useDatabase()
        .insert(tables.stockExchanges)
        .values({ id: createId('exch'), userId, createdAt: now, ...(await exchangeColumns(input)) })
    },

    async updateExchange(userId: string, id: string, input: ExchangeInput) {
      const stored = await findExchange(userId, id)
      await useDatabase()
        .update(tables.stockExchanges)
        .set(await exchangeColumns(input, stored))
        .where(and(eq(tables.stockExchanges.userId, userId), eq(tables.stockExchanges.id, id)))
    },

    async removeExchange(userId: string, id: string) {
      await useDatabase()
        .delete(tables.stockExchanges)
        .where(and(eq(tables.stockExchanges.userId, userId), eq(tables.stockExchanges.id, id)))
    },

    async addTrade(userId: string, input: TradeInput) {
      await assertRoom(tables.stockTrades, userId)
      const now = new Date().toISOString()
      await useDatabase()
        .insert(tables.stockTrades)
        .values({ id: createId('trade'), userId, createdAt: now, ...(await tradeColumns(input)) })
    },

    async updateTrade(userId: string, id: string, input: TradeInput) {
      const stored = await findTrade(userId, id)
      await useDatabase()
        .update(tables.stockTrades)
        .set(await tradeColumns(input, stored))
        .where(and(eq(tables.stockTrades.userId, userId), eq(tables.stockTrades.id, id)))
    },

    async removeTrade(userId: string, id: string) {
      await useDatabase()
        .delete(tables.stockTrades)
        .where(and(eq(tables.stockTrades.userId, userId), eq(tables.stockTrades.id, id)))
    }
  }
}
