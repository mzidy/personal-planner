import { and, asc, eq, sql } from 'drizzle-orm'
import type { WatchlistItem, WatchlistView } from '~~/shared/types/watchlist'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'
import { fetchWatchlistQuote } from '~~/server/utils/watchlist-quotes'

export const WATCHLIST_LIMIT = 25

export function useWatchlistRepository() {
  return {
    async list(userId: string) {
      return useDatabase()
        .select()
        .from(tables.watchlistItems)
        .where(eq(tables.watchlistItems.userId, userId))
        .orderBy(asc(tables.watchlistItems.position), asc(tables.watchlistItems.createdAt))
    },

    /** The list with a live quote for each ticker; one failing ticker does not hide the rest. */
    async view(userId: string): Promise<WatchlistView> {
      const rows = await this.list(userId)
      const quotes = await Promise.allSettled(rows.map(row => fetchWatchlistQuote(row.symbol)))
      const items: WatchlistItem[] = rows.map((row, index) => {
        const result = quotes[index]!
        if (result.status === 'fulfilled') {
          return { ...result.value, id: row.id, position: row.position, symbol: row.symbol, error: '' }
        }
        return {
          id: row.id,
          position: row.position,
          symbol: row.symbol,
          name: row.symbol,
          currency: '',
          price: null,
          change: null,
          changePercent: null,
          ma200: null,
          gapToMa200Percent: null,
          marketOpen: false,
          asOf: null,
          error: (result.reason as { statusMessage?: string })?.statusMessage || 'Quote unavailable right now.'
        }
      })
      return { items, marketOpen: items.some(item => item.marketOpen), fetchedAt: new Date().toISOString() }
    },

    async add(userId: string, symbol: string) {
      const db = useDatabase()
      const [last] = await db
        .select({ position: sql<number>`max(${tables.watchlistItems.position})`, count: sql<number>`count(*)` })
        .from(tables.watchlistItems)
        .where(eq(tables.watchlistItems.userId, userId))
      if (Number(last?.count ?? 0) >= WATCHLIST_LIMIT) {
        throw createError({ statusCode: 409, statusMessage: `The watchlist holds up to ${WATCHLIST_LIMIT} tickers.` })
      }
      const [existing] = await db
        .select({ id: tables.watchlistItems.id })
        .from(tables.watchlistItems)
        .where(and(eq(tables.watchlistItems.userId, userId), eq(tables.watchlistItems.symbol, symbol)))
        .limit(1)
      if (existing) {
        throw createError({ statusCode: 409, statusMessage: `${symbol} is already on the watchlist.` })
      }
      await db.insert(tables.watchlistItems).values({
        id: createId('watch'),
        userId,
        symbol,
        position: Number(last?.position ?? -1) + 1,
        createdAt: new Date().toISOString()
      })
    },

    async remove(userId: string, id: string) {
      await useDatabase()
        .delete(tables.watchlistItems)
        .where(and(eq(tables.watchlistItems.userId, userId), eq(tables.watchlistItems.id, id)))
    },

    /** Saves a new order. Ids that are not the user's are ignored. */
    async reorder(userId: string, ids: string[]) {
      const db = useDatabase()
      for (const [position, id] of ids.entries()) {
        await db
          .update(tables.watchlistItems)
          .set({ position })
          .where(and(eq(tables.watchlistItems.userId, userId), eq(tables.watchlistItems.id, id)))
      }
    }
  }
}
