/** One side of a trade as it was filled. Prices are in the stock's own currency. */
export interface TradeLeg {
  symbol: string
  name: string
  currency: string
  price: number
  /** YYYY-MM-DD */
  date: string
  /** Number of shares; fractional shares are allowed. */
  quantity: number
}

/**
 * Selling one stock and putting the money into another. It stays active while
 * the bought stock is held; closing it records the bought stock's exit price
 * and what the sold stock closed at that same day, so the result is frozen.
 */
export interface StockExchangeRecord {
  id: string
  sold: TradeLeg
  bought: TradeLeg
  note: string
  closedDate: string | null
  /** The bought stock's exit price. */
  closedBoughtPrice: number | null
  /** The sold stock's close on the closing day: what keeping it would have been worth. */
  closedSoldPrice: number | null
  createdAt: string
}

/** A single long position, from entry to exit. */
export interface OpenTradeRecord {
  id: string
  symbol: string
  name: string
  currency: string
  quantity: number
  entryPrice: number
  entryDate: string
  targetPrice: number | null
  stopPrice: number | null
  note: string
  exitPrice: number | null
  exitDate: string | null
  createdAt: string
}

export interface ExchangeResult {
  /** Money the sale brought in. */
  proceeds: number
  /** Money the purchase took. */
  cost: number
  /** The bought shares at today's (or the exit) price. */
  boughtValue: number
  /** The sold shares, had they been kept, at today's (or the closing day's) price. */
  keptValue: number
  boughtReturnPercent: number
  keptReturnPercent: number
  /** How far the bought stock is ahead of the sold one, in percentage points. */
  edgePoints: number
  /**
   * Gain on the bought shares minus the gain the sold shares would have made.
   * Null when the two stocks trade in different currencies.
   */
  edgeValue: number | null
  /** Days from the first of the two fills to today or the close. */
  days: number
}

export interface TradeResult {
  cost: number
  value: number
  pnl: number
  pnlPercent: number
  days: number
  /** How far the price still has to move to reach the target, in percent. */
  toTargetPercent: number | null
  /** How far the price can fall before the stop, in percent (negative while above it). */
  toStopPercent: number | null
  /** Gain in units of the risk taken (entry minus stop); null without a stop below entry. */
  rMultiple: number | null
  /** 0 at the stop, 1 at the target; null unless both are set. */
  rangeProgress: number | null
}

/** Money totals are kept per currency; adding dollars to euros would mean nothing. */
export type CurrencyTotals = Record<string, number>

export interface ExtremeTrade {
  id: string
  label: string
  value: number
}

export interface ExchangeStats {
  count: number
  wins: number
  winRate: number | null
  averageEdgePoints: number | null
  /** What the bought stocks returned on average, and what the sold ones would have. */
  averageBoughtReturnPercent: number | null
  averageKeptReturnPercent: number | null
  edgeValue: CurrencyTotals
  averageDays: number | null
  best: ExtremeTrade | null
  worst: ExtremeTrade | null
}

export interface TradeStats {
  count: number
  wins: number
  winRate: number | null
  pnl: CurrencyTotals
  averageReturnPercent: number | null
  averageWinPercent: number | null
  averageLossPercent: number | null
  /** Gross gains over gross losses; null with no losses yet or with trades in several currencies. */
  profitFactor: number | null
  averageDays: number | null
  best: ExtremeTrade | null
  worst: ExtremeTrade | null
}

export interface ExchangeView extends StockExchangeRecord {
  /** Live price, or the frozen closing price once closed. */
  soldNow: number | null
  boughtNow: number | null
  result: ExchangeResult | null
  /** Set when a live price could not be fetched just now. */
  quoteError: string
}

export interface TradeView extends OpenTradeRecord {
  now: number | null
  result: TradeResult | null
  quoteError: string
}

export interface TradesView {
  exchanges: ExchangeView[]
  trades: TradeView[]
  stats: {
    /** Closed exchanges only: the track record. */
    exchanges: ExchangeStats
    /** Closed trades only. */
    trades: TradeStats
  }
  /** Any held stock's market is in its regular session, so the page keeps refreshing. */
  marketOpen: boolean
  fetchedAt: string
}

export interface CloseOnDate {
  symbol: string
  /** The trading day the close belongs to; the last one on or before the asked date. */
  date: string
  close: number
  currency: string
}
