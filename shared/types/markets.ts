export interface MarketPoint {
  /** ISO-week Monday, e.g. 2026-09-07. */
  weekKey: string
  label: string
  close: number
  /** Percent change from the first week in the window. */
  changePercent: number
}

export interface MarketSeries {
  symbol: string
  name: string
  points: MarketPoint[]
  latestClose: number | null
  /** Percent change across the whole window. */
  changePercent: number | null
}

export interface VolatilityPoint {
  weekKey: string
  label: string
  /** The index level itself, not a percent change. */
  close: number
}

/**
 * The VIX is read as a level, not as a move: 18 means something on its own.
 * It is also far more volatile than the equity indices, so it is kept off
 * their shared percent axis rather than flattening them.
 */
export interface VolatilitySeries {
  symbol: string
  name: string
  points: VolatilityPoint[]
  latest: number | null
  low: number | null
  high: number | null
  changePercent: number | null
  /** Plain-language reading of the current level. */
  band: 'calm' | 'normal' | 'elevated' | 'high'
}

export interface MarketsOverview {
  series: MarketSeries[]
  volatility: VolatilitySeries | null
  fetchedAt: string
  /** Set when the upstream feed could not be reached; series is then empty. */
  error: string | null
}
