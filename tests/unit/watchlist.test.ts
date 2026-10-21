import { describe, expect, it } from 'vitest'
import { WATCHLIST_SYMBOL, moveInList, readWatchlistQuote, type YahooChartResult } from '../../shared/utils/watchlist'

const DAY = 86_400
// 2026-10-19 13:30 UTC, the open of a New York session, as Yahoo stamps daily bars.
const OCT_19 = 1792416600
const NEW_YORK = { gmtoffset: -14400, start: OCT_19 + 2 * DAY, end: OCT_19 + 2 * DAY + 6.5 * 3600 }

/** Daily bars from Oct 19 onwards (or ending before it, for long histories). */
function chart(closes: (number | null)[], meta: YahooChartResult['meta'], firstBar = OCT_19): YahooChartResult {
  return {
    meta: { symbol: 'TEST', currency: 'USD', longName: 'Test Inc.', ...meta },
    timestamp: closes.map((_, index) => firstBar + index * DAY),
    indicators: { quote: [{ close: closes }] }
  }
}

describe('readWatchlistQuote', () => {
  it('before the open: the daily change is the last session against the one before', () => {
    // Bars end on Oct 20; the price is Oct 20's close, stamped at its close.
    const result = chart([100, 110], {
      regularMarketPrice: 110,
      regularMarketTime: OCT_19 + DAY + 6.5 * 3600,
      currentTradingPeriod: { regular: NEW_YORK }
    })
    const quote = readWatchlistQuote('TEST', result, (NEW_YORK.start - 3600) * 1000)
    expect(quote).toMatchObject({ price: 110, change: 10, changePercent: 10, marketOpen: false, name: 'Test Inc.' })
  })

  it('during the session: the live price against yesterday, and the market is open', () => {
    // Yahoo adds today's still-moving bar; the price is live.
    const result = chart([100, 110, 112.2], {
      regularMarketPrice: 112.2,
      regularMarketTime: NEW_YORK.start + 3600,
      currentTradingPeriod: { regular: NEW_YORK }
    })
    const quote = readWatchlistQuote('TEST', result, (NEW_YORK.start + 3600) * 1000)
    expect(quote).toMatchObject({ price: 112.2, change: 2.2, changePercent: 2, marketOpen: true })
  })

  it("judges the session by the exchange's own date, not UTC's", () => {
    // 01:00 UTC on Oct 21 is still Oct 20 in New York, so Oct 20's bar is today's.
    const result = chart([100, 110], {
      regularMarketPrice: 110,
      regularMarketTime: OCT_19 + DAY + 11.5 * 3600,
      currentTradingPeriod: { regular: NEW_YORK }
    })
    expect(readWatchlistQuote('TEST', result).change).toBe(10)
  })

  it('averages the last 200 closes and skips missing ones', () => {
    const closes: (number | null)[] = Array.from({ length: 250 }, (_, index) => index + 1)
    closes[120] = null
    const result = chart(
      closes,
      { regularMarketPrice: 250, regularMarketTime: OCT_19 + DAY + 3600, currentTradingPeriod: { regular: NEW_YORK } },
      OCT_19 - 248 * DAY
    )
    const quote = readWatchlistQuote('TEST', result)
    // 121 is missing and falls inside the window, so the last 200 real closes are 50..250 without 121.
    const window = closes.filter((close): close is number => close !== null).slice(-200)
    expect(window[0]).toBe(50)
    const expected = Math.round((window.reduce((a, b) => a + b, 0) / 200) * 100) / 100
    expect(quote.ma200).toBe(expected)
    expect(quote.gapToMa200Percent).toBe(Math.round(((250 - expected) / expected) * 10000) / 100)
  })

  it('has no average with fewer than 200 closes', () => {
    const quote = readWatchlistQuote('TEST', chart([1, 2, 3], { regularMarketPrice: 3, regularMarketTime: OCT_19 + DAY }))
    expect(quote.ma200).toBeNull()
    expect(quote.gapToMa200Percent).toBeNull()
  })
})

describe('moveInList', () => {
  it('swaps with the neighbour and leaves the ends alone', () => {
    expect(moveInList(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveInList(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
    expect(moveInList(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveInList(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
    expect(moveInList(['a'], 'x', 1)).toEqual(['a'])
  })
})

describe('WATCHLIST_SYMBOL', () => {
  it('accepts tickers as Yahoo writes them', () => {
    for (const symbol of ['AAPL', 'VWCE.DE', 'BTC-USD', '^GSPC', 'EURUSD=X', 'BRK-B']) {
      expect(WATCHLIST_SYMBOL.test(symbol)).toBe(true)
    }
    for (const symbol of ['', 'AAPL MSFT', 'A/B', 'X'.repeat(16)]) {
      expect(WATCHLIST_SYMBOL.test(symbol)).toBe(false)
    }
  })
})
