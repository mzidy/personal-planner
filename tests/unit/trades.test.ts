import { describe, expect, it } from 'vitest'
import { exchangeInputSchema, tradeInputSchema } from '../../shared/schemas/trades'
import type { OpenTradeRecord, StockExchangeRecord, TradeLeg } from '../../shared/types/trades'
import { closeOnDate, daysBetween, exchangeResult, exchangeStats, tradeResult, tradeStats } from '../../shared/utils/trades'

const TODAY = '2026-10-23'

function leg(symbol: string, price: number, quantity: number, date: string, currency = 'USD'): TradeLeg {
  return { symbol, name: symbol, currency, price, quantity, date }
}

function exchange(sold: TradeLeg, bought: TradeLeg, close?: { date: string; sold: number; bought: number }): StockExchangeRecord {
  return {
    id: `${sold.symbol}-${bought.symbol}`,
    sold,
    bought,
    note: '',
    closedDate: close?.date ?? null,
    closedSoldPrice: close?.sold ?? null,
    closedBoughtPrice: close?.bought ?? null,
    createdAt: TODAY
  }
}

function trade(fields: Partial<OpenTradeRecord> & Pick<OpenTradeRecord, 'symbol' | 'entryPrice' | 'quantity'>): OpenTradeRecord {
  return {
    id: fields.symbol,
    name: fields.symbol,
    currency: 'USD',
    entryDate: '2026-10-01',
    targetPrice: null,
    stopPrice: null,
    note: '',
    exitPrice: null,
    exitDate: null,
    createdAt: TODAY,
    ...fields
  }
}

describe('exchangeResult', () => {
  it('compares the bought stock with what the sold one would have done', () => {
    // 10 NBIS sold at 100 paid for 20 HOOD at 50. NBIS is now 110 (+10%), HOOD 60 (+20%).
    const result = exchangeResult(exchange(leg('NBIS', 100, 10, '2026-10-01'), leg('HOOD', 50, 20, '2026-10-02')), 110, 60, TODAY)
    expect(result).toEqual({
      proceeds: 1000,
      cost: 1000,
      boughtValue: 1200,
      keptValue: 1100,
      boughtReturnPercent: 20,
      keptReturnPercent: 10,
      edgePoints: 10,
      edgeValue: 100,
      days: 22
    })
  })

  it('does not count cash added to the purchase as a gain', () => {
    // 250 of extra cash went into HOOD: its gain is 250 against NBIS's 100, not 1500 against 1100.
    const result = exchangeResult(exchange(leg('NBIS', 100, 10, '2026-10-01'), leg('HOOD', 50, 25, '2026-10-01')), 110, 60, TODAY)
    expect(result.cost).toBe(1250)
    expect(result.edgeValue).toBe(150)
    expect(result.edgePoints).toBe(10)
  })

  it('has no money edge across currencies, and counts days to the close once closed', () => {
    const closed = exchange(leg('SAP.DE', 200, 5, '2026-09-01', 'EUR'), leg('MSFT', 400, 2, '2026-09-02'), {
      date: '2026-10-01',
      sold: 190,
      bought: 420
    })
    const result = exchangeResult(closed, 190, 420, TODAY)
    expect(result.edgeValue).toBeNull()
    expect(result.edgePoints).toBe(10)
    expect(result.days).toBe(30)
  })
})

describe('tradeResult', () => {
  it('measures an open trade against its entry, stop and target', () => {
    const result = tradeResult(trade({ symbol: 'AAPL', entryPrice: 100, quantity: 10, stopPrice: 90, targetPrice: 130 }), 115, TODAY)
    expect(result).toEqual({
      cost: 1000,
      value: 1150,
      pnl: 150,
      pnlPercent: 15,
      days: 22,
      toTargetPercent: 13.04,
      toStopPercent: -21.74,
      rMultiple: 1.5,
      rangeProgress: 0.625
    })
  })

  it('stops tracking distances once closed, and has no R without a stop under the entry', () => {
    const result = tradeResult(
      trade({ symbol: 'AAPL', entryPrice: 100, quantity: 10, targetPrice: 130, stopPrice: 105, exitPrice: 80, exitDate: '2026-10-11' }),
      80,
      TODAY
    )
    expect(result).toMatchObject({ pnl: -200, pnlPercent: -20, days: 10, toTargetPercent: null, toStopPercent: null, rMultiple: null, rangeProgress: null })
  })
})

describe('track record', () => {
  it('scores only closed exchanges', () => {
    const items = [
      exchange(leg('A', 100, 1, '2026-09-01'), leg('B', 100, 1, '2026-09-01'), { date: '2026-09-11', sold: 110, bought: 120 }),
      exchange(leg('C', 100, 1, '2026-09-01'), leg('D', 100, 1, '2026-09-01'), { date: '2026-09-21', sold: 100, bought: 95 }),
      exchange(leg('E', 100, 1, '2026-09-01'), leg('F', 100, 1, '2026-09-01'))
    ].map(item => ({ ...item, result: exchangeResult(item, item.closedSoldPrice ?? 100, item.closedBoughtPrice ?? 200, TODAY) }))

    expect(exchangeStats(items)).toEqual({
      count: 2,
      wins: 1,
      winRate: 50,
      averageEdgePoints: 2.5,
      averageBoughtReturnPercent: 7.5,
      averageKeptReturnPercent: 5,
      edgeValue: { USD: 5 },
      averageDays: 15,
      best: { id: 'A-B', label: 'A → B', value: 10 },
      worst: { id: 'C-D', label: 'C → D', value: -5 }
    })
  })

  it('sums trades per currency and gives a profit factor only in one currency', () => {
    const closed = [
      trade({ symbol: 'W1', entryPrice: 100, quantity: 10, exitPrice: 130, exitDate: '2026-10-05' }),
      trade({ symbol: 'L1', entryPrice: 100, quantity: 10, exitPrice: 90, exitDate: '2026-10-09' }),
      trade({ symbol: 'OPEN', entryPrice: 100, quantity: 10 })
    ]
    const scored = closed.map(item => ({ ...item, result: tradeResult(item, item.exitPrice ?? 500, TODAY) }))
    expect(tradeStats(scored)).toEqual({
      count: 2,
      wins: 1,
      winRate: 50,
      pnl: { USD: 200 },
      averageReturnPercent: 10,
      averageWinPercent: 30,
      averageLossPercent: -10,
      profitFactor: 3,
      averageDays: 6,
      best: { id: 'W1', label: 'W1', value: 30 },
      worst: { id: 'L1', label: 'L1', value: -10 }
    })

    const euro = trade({ symbol: 'E1', currency: 'EUR', entryPrice: 10, quantity: 10, exitPrice: 9, exitDate: '2026-10-09' })
    const mixed = tradeStats([...scored, { ...euro, result: tradeResult(euro, 9, TODAY) }])
    expect(mixed.pnl).toEqual({ USD: 200, EUR: -10 })
    expect(mixed.profitFactor).toBeNull()
  })

  it('is empty before anything has closed', () => {
    expect(tradeStats([])).toMatchObject({ count: 0, winRate: null, averageReturnPercent: null, profitFactor: null, best: null })
    expect(exchangeStats([])).toMatchObject({ count: 0, winRate: null, averageEdgePoints: null, edgeValue: {}, worst: null })
  })
})

describe('closeOnDate', () => {
  // Daily bars stamped at the New York open (13:30 UTC) for Thu Oct 15 and Fri Oct 16, 2026.
  const THU = Date.parse('2026-10-15T13:30:00Z') / 1000
  const chart = {
    meta: { currency: 'USD', currentTradingPeriod: { regular: { gmtoffset: -14400 } } },
    timestamp: [THU, THU + 86_400],
    indicators: { quote: [{ close: [101.123456, 102.5] }] }
  }

  it('takes the last trading day on or before the date', () => {
    expect(closeOnDate(chart, '2026-10-16')).toEqual({ date: '2026-10-16', close: 102.5 })
    expect(closeOnDate(chart, '2026-10-18')).toEqual({ date: '2026-10-16', close: 102.5 })
    expect(closeOnDate(chart, '2026-10-15')).toEqual({ date: '2026-10-15', close: 101.1235 })
    expect(closeOnDate(chart, '2026-10-14')).toBeNull()
  })

  it("dates a bar by the exchange's day, not UTC's", () => {
    // Tokyo opens at 00:00 UTC; at +9h that bar belongs to the same calendar day there.
    const tokyo = { ...chart, meta: { currentTradingPeriod: { regular: { gmtoffset: 32400 } } }, timestamp: [Date.parse('2026-10-15T00:00:00Z') / 1000] }
    expect(closeOnDate(tokyo, '2026-10-15')?.date).toBe('2026-10-15')
  })
})

describe('daysBetween', () => {
  it('counts calendar days and never goes negative', () => {
    expect(daysBetween('2026-10-01', '2026-10-23')).toBe(22)
    expect(daysBetween('2026-10-23', '2026-10-01')).toBe(0)
  })
})

describe('input schemas', () => {
  const sold = { symbol: 'nbis', price: 100, quantity: 10, date: '2026-10-01' }
  const bought = { symbol: 'HOOD', price: 50, quantity: 20, date: '2026-10-02' }

  it('accepts an active exchange and writes tickers in capitals', () => {
    const parsed = exchangeInputSchema.parse({ sold, bought })
    expect(parsed.sold.symbol).toBe('NBIS')
    expect(parsed).toMatchObject({ note: '', closedDate: null, closedSoldPrice: null, closedBoughtPrice: null })
  })

  it('needs every closing field, after the purchase', () => {
    expect(exchangeInputSchema.safeParse({ sold, bought, closedDate: '2026-10-10' }).success).toBe(false)
    expect(
      exchangeInputSchema.safeParse({ sold, bought, closedDate: '2026-10-01', closedSoldPrice: 1, closedBoughtPrice: 1 }).success
    ).toBe(false)
    expect(
      exchangeInputSchema.safeParse({ sold, bought, closedDate: '2026-10-10', closedSoldPrice: 1, closedBoughtPrice: 1 }).success
    ).toBe(true)
  })

  it('refuses future dates, zero lots and a stop above the target', () => {
    expect(tradeInputSchema.safeParse({ symbol: 'AAPL', quantity: 1, entryPrice: 1, entryDate: '2099-01-01' }).success).toBe(false)
    expect(tradeInputSchema.safeParse({ symbol: 'AAPL', quantity: 0, entryPrice: 1, entryDate: '2026-10-01' }).success).toBe(false)
    const stop = tradeInputSchema.safeParse({ symbol: 'AAPL', quantity: 1, entryPrice: 10, entryDate: '2026-10-01', stopPrice: 12, targetPrice: 11 })
    expect(stop.success).toBe(false)
    expect(stop.error?.issues[0]?.message).toBe('The stop has to be below the target.')
    const exit = tradeInputSchema.safeParse({ symbol: 'AAPL', quantity: 1, entryPrice: 10, entryDate: '2026-10-01', exitPrice: 12 })
    expect(exit.error?.issues[0]?.message).toBe('Closing a trade needs both the exit price and the date.')
  })
})
