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

export interface MarketsOverview {
  series: MarketSeries[]
  fetchedAt: string
  /** Set when the upstream feed could not be reached; series is then empty. */
  error: string | null
}
