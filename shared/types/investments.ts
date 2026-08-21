export type InvestmentKind = 'etf' | 'stock' | 'option'
export type OptionType = 'call' | 'put'

export interface InvestmentPositionRecord {
  id: string
  userId: string
  kind: InvestmentKind
  symbol: string
  name: string
  quantity: number
  unitCost: number
  currentPrice: number | null
  currency: string
  notes: string
  openedAt: string | null
  optionType: OptionType | null
  strike: number | null
  expiry: string | null
  contractSize: number | null
  createdAt: string
  updatedAt: string
}

export interface PositionWithMetrics extends InvestmentPositionRecord {
  /** Contracts count for options (× contractSize), otherwise 1. */
  multiplier: number
  invested: number
  marketValue: number
  profitLoss: number
  profitLossPercent: number
  priced: boolean
}

export interface InvestmentTotals {
  positionCount: number
  invested: number
  marketValue: number
  profitLoss: number
  profitLossPercent: number
}

export interface InvestmentGroup extends InvestmentTotals {
  kind: InvestmentKind
  label: string
  blurb: string
  positions: PositionWithMetrics[]
}

export interface InvestmentsOverview {
  groups: InvestmentGroup[]
  totals: InvestmentTotals
}
