import { format, parseISO, startOfISOWeek } from 'date-fns'
import type {
  MarketPoint,
  MarketSeries,
  MarketsOverview,
  VolatilityPoint,
  VolatilitySeries
} from '~~/shared/types/markets'

export const MARKET_WEEKS = 12

const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq Composite' }
] as const

const VIX = { symbol: '^VIX', name: 'VIX' }

/** The conventional readings of the level, used for the one-word label. */
function volatilityBand(level: number): VolatilitySeries['band'] {
  if (level < 15) return 'calm'
  if (level < 20) return 'normal'
  if (level < 30) return 'elevated'
  return 'high'
}

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

/**
 * Weekly VIX levels. Kept separate from the index comparison: over the same
 * twelve weeks the equity indices move a couple of percent while the VIX can
 * move thirty, so sharing their percent axis would flatten both of them.
 */
async function fetchVolatility(): Promise<VolatilitySeries> {
  const response = await $fetch<YahooChartResponse>(`${YAHOO_CHART}/${encodeURIComponent(VIX.symbol)}`, {
    query: { range: '6mo', interval: '1wk' },
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SereneExecutive/1.0)' },
    timeout: 8000,
    retry: 1
  })

  const result = response.chart?.result?.[0]
  const timestamps = result?.timestamp || []
  const closes = result?.indicators?.quote?.[0]?.close || []

  if (!timestamps.length) {
    throw new Error('No data returned for the VIX.')
  }

  const byWeek = new Map<string, number>()
  timestamps.forEach((timestamp, index) => {
    const close = closes[index]
    if (close === null || close === undefined) {
      return
    }
    byWeek.set(weekKeyOf(timestamp), close)
  })

  const weeks = [...byWeek.keys()].sort().slice(-MARKET_WEEKS)
  const points: VolatilityPoint[] = weeks.map(weekKey => ({
    weekKey,
    label: format(parseISO(weekKey), 'MMM d'),
    close: round(byWeek.get(weekKey)!)
  }))

  const values = points.map(point => point.close)
  const latest = values[values.length - 1] ?? null
  const first = values[0]

  return {
    symbol: VIX.symbol,
    name: VIX.name,
    points,
    latest,
    low: values.length ? round(Math.min(...values)) : null,
    high: values.length ? round(Math.max(...values)) : null,
    changePercent: first && latest !== null ? round(((latest - first) / first) * 100) : null,
    band: latest === null ? 'normal' : volatilityBand(latest)
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
        const [series, volatility] = await Promise.all([
          Promise.all(INDICES.map(index => fetchSeries(index.symbol, index.name))),
          // The VIX is a bonus panel, not the point of the card — if it fails
          // the two indices still render.
          fetchVolatility().catch(() => null)
        ])
        payload = { series, volatility, fetchedAt: new Date().toISOString(), error: null }
      } catch (error) {
        ttl = FAILURE_TTL_MS
        payload = {
          series: [],
          volatility: null,
          fetchedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Market data is unavailable right now.'
        }
      }

      cache = { payload, expiresAt: Date.now() + ttl }
      return payload
    }
  }
}
