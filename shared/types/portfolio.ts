import type { PositionWithMetrics } from '~~/shared/types/investments'

export interface PortfolioRuleRecord {
  id: string
  userId: string
  name: string
  description: string
  /** Date-only (YYYY-MM-DD) the rule was set. */
  dateSet: string
  isIndex: boolean
  geo: string
  createdAt: string
  updatedAt: string
}

export interface PortfolioOverview {
  rules: PortfolioRuleRecord[]
  /** The holdings the rules will be checked against. */
  positions: PositionWithMetrics[]
  invested: number
  marketValue: number
}
