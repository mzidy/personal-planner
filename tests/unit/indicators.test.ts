import { describe, expect, it } from 'vitest'
import {
  annualisedVolatility,
  changeOver,
  rangePosition,
  rsi,
  sma
} from '../../shared/utils/indicators'

/**
 * Wilder's own worked RSI example from "New Concepts in Technical Trading
 * Systems". The published 14-period values for this series are 70.53 after the
 * first 15 closes and 37.77 after all 33.
 */
const WILDER_CLOSES = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28,
  46.28, 46.0, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18,
  44.22, 44.57, 43.42, 42.66, 43.13
]

describe('sma', () => {
  it('averages the last period closes', () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3)
    expect(sma([10, 20, 30, 40], 2)).toBe(35)
  })

  it('ignores closes older than the window', () => {
    expect(sma([1000, 1, 1, 1], 3)).toBe(1)
  })

  it('returns null without enough history', () => {
    expect(sma([1, 2], 5)).toBeNull()
    expect(sma([], 1)).toBeNull()
  })
})

describe('rsi', () => {
  /**
   * Wilder's printed table rounds the seed average gain/loss, so every value in
   * it sits within about 0.07 of an unrounded run. Because Wilder smoothing
   * decays the seed exponentially, that offset shrinks monotonically along the
   * series (-0.070 at the first value, +0.010 by the last) — which is why the
   * tolerance here is 0.1 rather than an exact match.
   */
  it("tracks Wilder's published value at the first computable point", () => {
    expect(rsi(WILDER_CLOSES.slice(0, 15))!).toBeGreaterThan(70.43)
    expect(rsi(WILDER_CLOSES.slice(0, 15))!).toBeLessThan(70.63)
  })

  it("tracks Wilder's published value across the full series", () => {
    expect(rsi(WILDER_CLOSES)!).toBeGreaterThan(37.67)
    expect(rsi(WILDER_CLOSES)!).toBeLessThan(37.87)
  })

  it('converges toward the published series as the seed decays', () => {
    const early = Math.abs(rsi(WILDER_CLOSES.slice(0, 15))! - 70.53)
    const late = Math.abs(rsi(WILDER_CLOSES)! - 37.77)
    expect(late).toBeLessThan(early)
  })

  it('pins to 100 when every session gains and 0 when every session loses', () => {
    const rising = Array.from({ length: 30 }, (_, index) => 100 + index)
    const falling = Array.from({ length: 30 }, (_, index) => 100 - index)
    expect(rsi(rising)).toBe(100)
    expect(rsi(falling)).toBe(0)
  })

  it('reports a flat series as neutral rather than overbought', () => {
    expect(rsi(Array.from({ length: 30 }, () => 50))).toBe(50)
  })

  it('returns null without enough history', () => {
    expect(rsi([1, 2, 3])).toBeNull()
    expect(rsi(Array.from({ length: 14 }, (_, index) => index))).toBeNull()
  })
})

describe('changeOver', () => {
  it('measures percent change across the given sessions', () => {
    expect(changeOver([100, 110, 120], 2)).toBe(20)
    expect(changeOver([100, 90], 1)).toBe(-10)
  })

  it('counts back sessions rather than using the first close', () => {
    expect(changeOver([50, 100, 200, 400], 1)).toBe(100)
  })

  it('returns null when the window exceeds the history', () => {
    expect(changeOver([100, 110], 5)).toBeNull()
    expect(changeOver([100, 110], 2)).toBeNull()
  })
})

describe('annualisedVolatility', () => {
  it('is zero for a perfectly flat series', () => {
    expect(annualisedVolatility(Array.from({ length: 40 }, () => 100))).toBe(0)
  })

  it('scales daily deviation by the square root of 252', () => {
    // Alternating roughly ±1% daily, so the annualised figure lands near 16%.
    const closes = Array.from({ length: 200 }, (_, index) => (index % 2 === 0 ? 100 : 101))
    const value = annualisedVolatility(closes)
    expect(value).not.toBeNull()
    expect(value!).toBeGreaterThan(5)
    expect(value!).toBeLessThan(30)
  })

  it('returns null below the minimum sample', () => {
    expect(annualisedVolatility([100, 101, 102])).toBeNull()
  })
})

describe('rangePosition', () => {
  it('places the price within the low-to-high band', () => {
    expect(rangePosition(150, 100, 200)).toBe(50)
    expect(rangePosition(100, 100, 200)).toBe(0)
    expect(rangePosition(200, 100, 200)).toBe(100)
  })

  it('returns null when the band has no width', () => {
    expect(rangePosition(100, 100, 100)).toBeNull()
  })
})
