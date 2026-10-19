export interface PricePoint {
  /** Trading day, YYYY-MM-DD. */
  date: string
  close: number
  /** 200-day simple moving average, null until there are 200 closes behind it. */
  ma200: number | null
}

export interface TickerSeries {
  symbol: string
  name: string
  currency: string
  points: PricePoint[]
  latestClose: number | null
  latestMa200: number | null
  /** Percent the last close sits above or below the 200-day average. */
  gapToMa200Percent: number | null
  /** Percent change across the charted window. */
  changePercent: number | null
  fetchedAt: string
}
