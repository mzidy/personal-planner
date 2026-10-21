import { z } from 'zod'
import { WATCHLIST_SYMBOL } from '../utils/watchlist'

export const watchlistAddSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(WATCHLIST_SYMBOL, 'Use a ticker as Yahoo writes it, for example AAPL, VWCE.DE or BTC-USD.')
})

export const watchlistOrderSchema = z.object({
  ids: z.array(z.string().min(1).max(80)).max(100)
})
