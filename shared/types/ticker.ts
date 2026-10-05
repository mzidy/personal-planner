export interface TechnicalSnapshot {
  price: number
  currency: string
  asOf: string
  sma20: number | null
  sma50: number | null
  sma200: number | null
  rsi14: number | null
  high52w: number | null
  low52w: number | null
  /** Where the price sits between the 52-week low (0%) and high (100%). */
  rangePosition: number | null
  return1m: number | null
  return3m: number | null
  return6m: number | null
  return12m: number | null
  /** Annualised standard deviation of daily returns, in percent. */
  volatility: number | null
  /** Plain-language observations derived from the numbers above. */
  signals: string[]
}

export interface FundamentalSnapshot {
  /** Null when the company files outside SEC EDGAR (non-US listings). */
  available: boolean
  source: string
  fiscalPeriod: string | null
  revenue: number | null
  revenueGrowthPercent: number | null
  netIncome: number | null
  operatingIncome: number | null
  netMarginPercent: number | null
  operatingMarginPercent: number | null
  assets: number | null
  liabilities: number | null
  equity: number | null
  debtToEquity: number | null
  returnOnEquityPercent: number | null
  sharesOutstanding: number | null
  marketCap: number | null
  peRatio: number | null
  signals: string[]
  note: string
}

export interface TickerReviewRecord {
  id: string
  userId: string
  symbol: string
  companyName: string
  technical: TechnicalSnapshot
  fundamental: FundamentalSnapshot
  review: string
  reviewError: string
  createdAt: string
}

export interface TickerReviewsPayload {
  history: TickerReviewRecord[]
}
