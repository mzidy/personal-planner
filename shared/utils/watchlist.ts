import type { WatchlistQuote } from '../types/watchlist'
import { round, sma } from './indicators'

/** The parts of Yahoo's chart response (range=1y, interval=1d) a quote is read from. */
export interface YahooChartResult {
  meta?: {
    symbol?: string
    currency?: string
    longName?: string
    shortName?: string
    regularMarketPrice?: number
    regularMarketTime?: number
    gmtoffset?: number
    currentTradingPeriod?: { regular?: { start?: number; end?: number; gmtoffset?: number } }
  }
  timestamp?: number[]
  indicators?: { quote?: { close?: (number | null)[] }[] }
}

/**
 * Price, daily change and 200-day average from one year of daily bars.
 *
 * The daily change is measured against the last close from a session before
 * the one the price belongs to. While the market is open Yahoo's last bar is
 * today's, still moving; before the open the last bar is yesterday's, so
 * "the previous bar" alone would be wrong half the time.
 */
export function readWatchlistQuote(symbol: string, result: YahooChartResult, now = Date.now()): WatchlistQuote {
  const meta = result.meta || {}
  const timestamps = result.timestamp || []
  const raw = result.indicators?.quote?.[0]?.close || []

  const bars: { time: number; close: number }[] = []
  timestamps.forEach((time, index) => {
    const close = raw[index]
    if (typeof close === 'number' && Number.isFinite(close)) {
      bars.push({ time, close })
    }
  })

  const last = bars[bars.length - 1]
  const price = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : last?.close ?? null
  const offset = meta.currentTradingPeriod?.regular?.gmtoffset ?? meta.gmtoffset ?? 0
  const dayOf = (time: number) => Math.floor((time + offset) / 86_400)
  const priceTime = meta.regularMarketTime ?? last?.time
  const previous = priceTime === undefined ? undefined : [...bars].reverse().find(bar => dayOf(bar.time) < dayOf(priceTime))

  const change = price !== null && previous ? round(price - previous.close) : null
  const changePercent = price !== null && previous?.close ? round(((price - previous.close) / previous.close) * 100) : null
  const ma200 = sma(
    bars.map(bar => bar.close),
    200
  )
  const regular = meta.currentTradingPeriod?.regular
  const seconds = now / 1000

  return {
    symbol: meta.symbol || symbol,
    name: meta.longName || meta.shortName || symbol,
    currency: meta.currency || 'USD',
    price: price === null ? null : round(price),
    change,
    changePercent,
    ma200,
    gapToMa200Percent: price !== null && ma200 ? round(((price - ma200) / ma200) * 100) : null,
    marketOpen: Boolean(regular?.start && regular?.end && seconds >= regular.start && seconds < regular.end),
    asOf: priceTime ? new Date(priceTime * 1000).toISOString() : null
  }
}

/** Symbols as Yahoo writes them: AAPL, VWCE.DE, BTC-USD, ^GSPC, EURUSD=X. */
export const WATCHLIST_SYMBOL = /^[A-Z0-9.\-^=]{1,15}$/

/** Moves one id up or down; the list is unchanged at either end. */
export function moveInList(ids: string[], id: string, direction: -1 | 1) {
  const from = ids.indexOf(id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= ids.length) {
    return ids
  }
  const next = [...ids]
  next[from] = ids[to]!
  next[to] = id
  return next
}
