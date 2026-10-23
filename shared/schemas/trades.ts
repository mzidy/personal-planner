import { z } from 'zod'
import { isoDay } from '../utils/trades'
import { WATCHLIST_SYMBOL } from '../utils/watchlist'

const symbol = z
  .string()
  .trim()
  .toUpperCase()
  .regex(WATCHLIST_SYMBOL, 'Use a ticker as Yahoo writes it, for example AAPL, VWCE.DE or BTC-USD.')

// A day of slack, so a fill entered late in the evening in Europe is not "in the future" in UTC.
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use dates as YYYY-MM-DD.')
  .refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'That date does not exist.')
  .refine(value => value <= isoDay(Date.now() + 86_400_000), 'Dates cannot be in the future.')

const price = z.number().finite().positive('Prices must be above zero.').max(1e9)
const quantity = z.number().finite().positive('The lot must be above zero.').max(1e9)
const note = z.string().trim().max(500).default('')

const leg = z.object({ symbol, price, date, quantity })

export const exchangeInputSchema = z
  .object({
    sold: leg,
    bought: leg,
    note,
    closedDate: date.nullable().default(null),
    closedBoughtPrice: price.nullable().default(null),
    closedSoldPrice: price.nullable().default(null)
  })
  .superRefine((value, ctx) => {
    const closing = [value.closedDate, value.closedBoughtPrice, value.closedSoldPrice].filter(field => field !== null)
    if (closing.length && closing.length < 3) {
      ctx.addIssue({ code: 'custom', message: 'Closing an exchange needs the date and both prices.' })
    }
    if (value.closedDate && value.closedDate < value.bought.date) {
      ctx.addIssue({ code: 'custom', message: 'An exchange cannot close before the purchase.' })
    }
  })

export const tradeInputSchema = z
  .object({
    symbol,
    quantity,
    entryPrice: price,
    entryDate: date,
    targetPrice: price.nullable().default(null),
    stopPrice: price.nullable().default(null),
    note,
    exitPrice: price.nullable().default(null),
    exitDate: date.nullable().default(null)
  })
  .superRefine((value, ctx) => {
    if ((value.exitPrice === null) !== (value.exitDate === null)) {
      ctx.addIssue({ code: 'custom', message: 'Closing a trade needs both the exit price and the date.' })
    }
    if (value.exitDate && value.exitDate < value.entryDate) {
      ctx.addIssue({ code: 'custom', message: 'A trade cannot close before its entry.' })
    }
    if (value.targetPrice !== null && value.stopPrice !== null && value.stopPrice >= value.targetPrice) {
      ctx.addIssue({ code: 'custom', message: 'The stop has to be below the target.' })
    }
  })

export const closeOnDateQuerySchema = z.object({ symbol, date })

export type ExchangeInput = z.infer<typeof exchangeInputSchema>
export type TradeInput = z.infer<typeof tradeInputSchema>
