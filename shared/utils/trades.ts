import type {
  CurrencyTotals,
  ExchangeResult,
  ExchangeStats,
  ExtremeTrade,
  OpenTradeRecord,
  StockExchangeRecord,
  TradeResult,
  TradeStats
} from '../types/trades'
import { round } from './indicators'
import type { YahooChartResult } from './watchlist'

const DAY_MS = 86_400_000

/** Today as YYYY-MM-DD (UTC), or any instant as one. */
export function isoDay(at = Date.now()) {
  return new Date(at).toISOString().slice(0, 10)
}

/** Whole days from one YYYY-MM-DD date to another; never negative. */
export function daysBetween(from: string, to: string) {
  return Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS))
}

/**
 * How an exchange has worked out: the bought stock from its purchase price,
 * against the sold stock from its sale price — what the money would have done
 * had it stayed put. Prices are today's while the exchange is active, and the
 * frozen closing prices once it is closed.
 *
 * The money edge compares gains rather than end values, so cash added to (or
 * left over from) the purchase does not count as a win or a loss.
 */
export function exchangeResult(exchange: StockExchangeRecord, soldNow: number, boughtNow: number, today = isoDay()): ExchangeResult {
  const { sold, bought } = exchange
  const proceeds = sold.quantity * sold.price
  const cost = bought.quantity * bought.price
  const boughtValue = bought.quantity * boughtNow
  const keptValue = sold.quantity * soldNow
  const boughtReturn = (boughtNow / bought.price - 1) * 100
  const keptReturn = (soldNow / sold.price - 1) * 100
  const start = sold.date < bought.date ? sold.date : bought.date

  return {
    proceeds: round(proceeds),
    cost: round(cost),
    boughtValue: round(boughtValue),
    keptValue: round(keptValue),
    boughtReturnPercent: round(boughtReturn),
    keptReturnPercent: round(keptReturn),
    edgePoints: round(boughtReturn - keptReturn),
    edgeValue: sold.currency === bought.currency ? round(boughtValue - cost - (keptValue - proceeds)) : null,
    days: daysBetween(start, exchange.closedDate ?? today)
  }
}

/** A long position at `now` (today's price, or the exit price once closed). */
export function tradeResult(trade: OpenTradeRecord, now: number, today = isoDay()): TradeResult {
  const cost = trade.quantity * trade.entryPrice
  const value = trade.quantity * now
  const open = trade.exitPrice === null
  const { targetPrice: target, stopPrice: stop } = trade
  const risk = stop !== null && stop < trade.entryPrice ? trade.entryPrice - stop : null

  return {
    cost: round(cost),
    value: round(value),
    pnl: round(value - cost),
    pnlPercent: round((now / trade.entryPrice - 1) * 100),
    days: daysBetween(trade.entryDate, trade.exitDate ?? today),
    toTargetPercent: open && target !== null ? round((target / now - 1) * 100) : null,
    toStopPercent: open && stop !== null ? round((stop / now - 1) * 100) : null,
    rMultiple: risk ? round((now - trade.entryPrice) / risk) : null,
    rangeProgress:
      open && target !== null && stop !== null && target > stop ? round(Math.min(1, Math.max(0, (now - stop) / (target - stop))), 3) : null
  }
}

function average(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

function addTo(totals: CurrencyTotals, currency: string, value: number) {
  totals[currency] = round((totals[currency] ?? 0) + value)
}

function extremes<T>(items: T[], score: (item: T) => number, toExtreme: (item: T) => ExtremeTrade) {
  if (!items.length) {
    return { best: null, worst: null }
  }
  const sorted = [...items].sort((a, b) => score(b) - score(a))
  return { best: toExtreme(sorted[0]!), worst: toExtreme(sorted[sorted.length - 1]!) }
}

type Scored<T> = T & { result: ExchangeResult | TradeResult | null }

/** The track record of closed exchanges; active ones are still moving and are left out. */
export function exchangeStats(exchanges: Scored<StockExchangeRecord>[]): ExchangeStats {
  const closed = exchanges
    .filter(exchange => exchange.closedDate !== null && exchange.result)
    .map(exchange => ({ ...exchange, result: exchange.result as ExchangeResult }))
  const wins = closed.filter(exchange => exchange.result.edgePoints > 0).length
  const edgeValue: CurrencyTotals = {}
  for (const exchange of closed) {
    if (exchange.result.edgeValue !== null) {
      addTo(edgeValue, exchange.bought.currency, exchange.result.edgeValue)
    }
  }

  return {
    count: closed.length,
    wins,
    winRate: closed.length ? round((wins / closed.length) * 100, 1) : null,
    averageEdgePoints: average(closed.map(exchange => exchange.result.edgePoints)),
    averageBoughtReturnPercent: average(closed.map(exchange => exchange.result.boughtReturnPercent)),
    averageKeptReturnPercent: average(closed.map(exchange => exchange.result.keptReturnPercent)),
    edgeValue,
    averageDays: average(closed.map(exchange => exchange.result.days)),
    ...extremes(
      closed,
      exchange => exchange.result.edgePoints,
      exchange => ({ id: exchange.id, label: `${exchange.sold.symbol} → ${exchange.bought.symbol}`, value: exchange.result.edgePoints })
    )
  }
}

/** The track record of closed trades. */
export function tradeStats(trades: Scored<OpenTradeRecord>[]): TradeStats {
  const closed = trades
    .filter(trade => trade.exitPrice !== null && trade.result)
    .map(trade => ({ ...trade, result: trade.result as TradeResult }))
  const winners = closed.filter(trade => trade.result.pnl > 0)
  const losers = closed.filter(trade => trade.result.pnl < 0)
  const pnl: CurrencyTotals = {}
  for (const trade of closed) {
    addTo(pnl, trade.currency, trade.result.pnl)
  }

  // Gross gains over gross losses only means something in a single currency.
  const grossLoss = -losers.reduce((sum, trade) => sum + trade.result.pnl, 0)
  const grossWin = winners.reduce((sum, trade) => sum + trade.result.pnl, 0)
  const oneCurrency = new Set(closed.map(trade => trade.currency)).size === 1

  return {
    count: closed.length,
    wins: winners.length,
    winRate: closed.length ? round((winners.length / closed.length) * 100, 1) : null,
    pnl,
    averageReturnPercent: average(closed.map(trade => trade.result.pnlPercent)),
    averageWinPercent: average(winners.map(trade => trade.result.pnlPercent)),
    averageLossPercent: average(losers.map(trade => trade.result.pnlPercent)),
    profitFactor: oneCurrency && grossLoss > 0 ? round(grossWin / grossLoss) : null,
    averageDays: average(closed.map(trade => trade.result.days)),
    ...extremes(
      closed,
      trade => trade.result.pnlPercent,
      trade => ({ id: trade.id, label: trade.symbol, value: trade.result.pnlPercent })
    )
  }
}

/**
 * The close of the last trading day on or before `date`, judged by the
 * exchange's own calendar day. A Saturday sale is priced at Friday's close.
 */
export function closeOnDate(result: YahooChartResult, date: string) {
  const offset = result.meta?.currentTradingPeriod?.regular?.gmtoffset ?? result.meta?.gmtoffset ?? 0
  const closes = result.indicators?.quote?.[0]?.close || []
  const timestamps = result.timestamp || []
  let found: { date: string; close: number } | null = null
  for (const [index, time] of timestamps.entries()) {
    const close = closes[index]
    const day = isoDay((time + offset) * 1000)
    if (typeof close === 'number' && Number.isFinite(close) && day <= date) {
      found = { date: day, close: round(close, 4) }
    }
  }
  return found
}
