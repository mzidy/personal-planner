import type { CloseOnDate } from '~~/shared/types/trades'
import type { WatchlistQuote } from '~~/shared/types/watchlist'
import { closeOnDate, isoDay } from '~~/shared/utils/trades'
import { type YahooChartResult, readWatchlistQuote } from '~~/shared/utils/watchlist'

/**
 * One live quote per ticker from Yahoo's chart endpoint: a year of daily
 * bars gives the previous close and the 200 closes behind the average, and
 * its meta carries the live price and the exchange's session times.
 */
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart'
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; SereneExecutive/1.0)' }

/** Shorter than the page's five-minute refresh, so each refresh sees fresh prices. */
const CACHE_TTL_MS = 60 * 1000

const cache = new Map<string, { quote: WatchlistQuote; expiresAt: number }>()

interface YahooChart {
  chart?: { result?: YahooChartResult[] | null; error?: { description?: string } | null }
}

export async function fetchWatchlistQuote(symbol: string): Promise<WatchlistQuote> {
  const cached = cache.get(symbol)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.quote
  }

  const response = await $fetch<YahooChart>(`${YAHOO_CHART}/${encodeURIComponent(symbol)}`, {
    query: { range: '1y', interval: '1d' },
    headers: YAHOO_HEADERS,
    timeout: 12000,
    retry: 1
  }).catch(() => null)

  const result = response?.chart?.result?.[0]
  if (!result?.timestamp?.length) {
    throw createError({ statusCode: 404, statusMessage: `No quote found for "${symbol}". Check the ticker.` })
  }

  const quote = readWatchlistQuote(symbol, result)
  cache.set(symbol, { quote, expiresAt: Date.now() + CACHE_TTL_MS })
  return quote
}

const closeCache = new Map<string, { close: CloseOnDate; expiresAt: number }>()

/**
 * The close of the last trading day on or before `date` (YYYY-MM-DD), used to
 * price a fill or what a sold stock was worth on a given day. Two weeks of
 * bars before the date cover any holiday run.
 */
export async function fetchCloseOnDate(symbol: string, date: string): Promise<CloseOnDate> {
  const key = `${symbol}:${date}`
  const cached = closeCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.close
  }

  const day = Date.parse(`${date}T00:00:00Z`) / 1000
  const response = await $fetch<YahooChart>(`${YAHOO_CHART}/${encodeURIComponent(symbol)}`, {
    query: { period1: day - 14 * 86_400, period2: day + 2 * 86_400, interval: '1d' },
    headers: YAHOO_HEADERS,
    timeout: 12000,
    retry: 1
  }).catch(() => null)

  const result = response?.chart?.result?.[0]
  const found = result ? closeOnDate(result, date) : null
  if (!found) {
    throw createError({ statusCode: 404, statusMessage: `No close found for ${symbol} on or before ${date}.` })
  }

  const close: CloseOnDate = { symbol, ...found, currency: result?.meta?.currency || 'USD' }
  // A past close is settled; today's is still moving.
  closeCache.set(key, { close, expiresAt: Date.now() + (found.date < isoDay() ? 6 * 3600_000 : CACHE_TTL_MS) })
  return close
}
