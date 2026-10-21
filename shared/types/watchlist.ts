export interface WatchlistQuote {
  symbol: string
  name: string
  currency: string
  /** Latest regular-session price (live while the market is open). */
  price: number | null
  /** Against the previous session's close. */
  change: number | null
  changePercent: number | null
  /** Average of the last 200 daily closes. */
  ma200: number | null
  gapToMa200Percent: number | null
  /** Inside the exchange's regular session right now. */
  marketOpen: boolean
  /** When the price was set, per the exchange. */
  asOf: string | null
}

export interface WatchlistItem extends WatchlistQuote {
  id: string
  position: number
  /** Set when this ticker's quote could not be fetched just now. */
  error: string
}

export interface WatchlistView {
  items: WatchlistItem[]
  /** Any listed market is in its regular session, so the page keeps refreshing. */
  marketOpen: boolean
  fetchedAt: string
}
