import { format, parseISO, startOfISOWeek } from 'date-fns'
import type { MarketPoint, MarketSeries, MarketsOverview } from '~~/shared/types/markets'

export const MARKET_WEEKS = 12

const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq Composite' }
] as const

/** Yahoo's chart endpoint is free and key-less, but it rate-limits, so responses are cached. */
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart'
const SUCCESS_TTL_MS = 30 * 60 * 1000
const FAILURE_TTL_MS = 60 * 1000

interface YahooChartResponse {
  chart?: {
    result?: {
      timestamp?: number[]
      indicators?: { quote?: { close?: (number | null)[] }[] }
    }[]
    error?: { description?: string } | null
  }
}

let cache: { payload: MarketsOverview; expiresAt: number } | null = null

function weekKeyOf(timestampSeconds: number) {
  return format(startOfISOWeek(new Date(timestampSeconds * 1000)), 'yyyy-MM-dd')
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

async function fetchSeries(symbol: string, name: string): Promise<MarketSeries> {
  const response = await $fetch<YahooChartResponse>(`${YAHOO_CHART}/${encodeURIComponent(symbol)}`, {
    query: { range: '6mo', interval: '1wk' },
    // Yahoo rejects requests without a browser-ish agent.
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SereneExecutive/1.0)' },
    timeout: 8000,
    retry: 1
  })

  const result = response.chart?.result?.[0]
  const timestamps = result?.timestamp || []
  const closes = result?.indicators?.quote?.[0]?.close || []

  if (!timestamps.length) {
    throw new Error(response.chart?.error?.description || `No data returned for ${symbol}.`)
  }

  // Yahoo repeats the in-progress week as a trailing partial bar, so collapse by
  // ISO week and keep the last close seen for each one.
  const byWeek = new Map<string, number>()
  timestamps.forEach((timestamp, index) => {
    const close = closes[index]
    if (close === null || close === undefined) {
      return
    }
    byWeek.set(weekKeyOf(timestamp), close)
  })

  const weeks = [...byWeek.keys()].sort().slice(-MARKET_WEEKS)
  const base = byWeek.get(weeks[0]!)!

  const points: MarketPoint[] = weeks.map(weekKey => {
    const close = byWeek.get(weekKey)!
    return {
      weekKey,
      label: format(parseISO(weekKey), 'MMM d'),
      close: round(close),
      changePercent: round(((close - base) / base) * 100)
    }
  })

  const last = points[points.length - 1]

  return {
    symbol,
    name,
    points,
    latestClose: last ? last.close : null,
    changePercent: last ? last.changePercent : null
  }
}

export function useMarketsRepository() {
  return {
    async getOverview(): Promise<MarketsOverview> {
      if (cache && cache.expiresAt > Date.now()) {
        return cache.payload
      }

      let payload: MarketsOverview
      let ttl = SUCCESS_TTL_MS

      try {
        const series = await Promise.all(INDICES.map(index => fetchSeries(index.symbol, index.name)))
        payload = { series, fetchedAt: new Date().toISOString(), error: null }
      } catch (error) {
        ttl = FAILURE_TTL_MS
        payload = {
          series: [],
          fetchedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Market data is unavailable right now.'
        }
      }

      cache = { payload, expiresAt: Date.now() + ttl }
      return payload
    }
  }
}
