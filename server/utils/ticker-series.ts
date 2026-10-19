import { format } from 'date-fns'
import type { PricePoint, TickerSeries } from '~~/shared/types/ticker-series'
import { round, sma } from '~~/shared/utils/indicators'

/**
 * Daily closes with a 200-day moving average, for charting one ticker.
 *
 * Three years are fetched but only the last year is returned: the average needs
 * 200 trading days behind each point, so without the extra history the line
 * would be blank for the first ten months of the chart.
 */
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart'
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; SereneExecutive/1.0)' }

const MA_WINDOW = 200
const CHART_DAYS = 252
const CACHE_TTL_MS = 15 * 60 * 1000

interface YahooChart {
  chart?: {
    result?: {
      meta?: { currency?: string; longName?: string; shortName?: string }
      timestamp?: number[]
      indicators?: { quote?: { close?: (number | null)[] }[] }
    }[]
    error?: { description?: string } | null
  }
}

const cache = new Map<string, { payload: TickerSeries; expiresAt: number }>()

export async function fetchTickerSeries(rawSymbol: string): Promise<TickerSeries> {
  const symbol = rawSymbol.trim().toUpperCase()

  const cached = cache.get(symbol)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload
  }

  const response = await $fetch<YahooChart>(`${YAHOO_CHART}/${encodeURIComponent(symbol)}`, {
    query: { range: '3y', interval: '1d' },
    headers: YAHOO_HEADERS,
    timeout: 12000,
    retry: 1
  }).catch(() => null)

  const result = response?.chart?.result?.[0]
  const timestamps = result?.timestamp || []
  const rawCloses = result?.indicators?.quote?.[0]?.close || []

  const closes: number[] = []
  const dates: string[] = []
  timestamps.forEach((timestamp, index) => {
    const close = rawCloses[index]
    if (close === null || close === undefined) {
      return
    }
    closes.push(close)
    dates.push(format(new Date(timestamp * 1000), 'yyyy-MM-dd'))
  })

  if (closes.length < 2) {
    throw createError({
      statusCode: 404,
      statusMessage: `No price history found for "${symbol}". Check the ticker.`
    })
  }

  const start = Math.max(0, closes.length - CHART_DAYS)
  const points: PricePoint[] = []

  for (let index = start; index < closes.length; index += 1) {
    points.push({
      date: dates[index]!,
      close: round(closes[index]!),
      // sma() reads the tail of what it is given, so each point gets the
      // average of the 200 closes ending at it.
      ma200: sma(closes.slice(0, index + 1), MA_WINDOW)
    })
  }

  const last = points[points.length - 1]!
  const first = points[0]!

  const payload: TickerSeries = {
    symbol,
    name: result?.meta?.longName || result?.meta?.shortName || symbol,
    currency: result?.meta?.currency || 'USD',
    points,
    latestClose: last.close,
    latestMa200: last.ma200,
    gapToMa200Percent: last.ma200 ? round(((last.close - last.ma200) / last.ma200) * 100) : null,
    changePercent: first.close ? round(((last.close - first.close) / first.close) * 100) : null,
    fetchedAt: new Date().toISOString()
  }

  cache.set(symbol, { payload, expiresAt: Date.now() + CACHE_TTL_MS })
  return payload
}
