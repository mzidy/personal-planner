import { describe, expect, it } from 'vitest'
import {
  calculateEndAmount,
  effectiveAnnualRate,
  solveContribution,
  solveReturnRate,
  solveStartingAmount,
  solveYears,
  type InvestmentInputs
} from '../../shared/utils/investment-math'

/** The worked example this calculator was specified against. */
const REFERENCE: InvestmentInputs = {
  startingAmount: 20000,
  years: 10,
  returnRate: 6,
  compound: 'annually',
  contribution: 1000,
  contributionFrequency: 'month',
  contributionTiming: 'end'
}

describe('effectiveAnnualRate', () => {
  it('leaves an annually compounded rate alone', () => {
    expect(effectiveAnnualRate(6, 'annually')).toBeCloseTo(0.06, 10)
  })

  it('lifts the effective rate as compounding gets more frequent', () => {
    const annual = effectiveAnnualRate(6, 'annually')
    const monthly = effectiveAnnualRate(6, 'monthly')
    const daily = effectiveAnnualRate(6, 'daily')
    expect(monthly).toBeGreaterThan(annual)
    expect(daily).toBeGreaterThan(monthly)
    expect(monthly).toBeCloseTo(0.0616778, 6)
  })
})

describe('calculateEndAmount', () => {
  it('reproduces the reference case exactly', () => {
    const result = calculateEndAmount(REFERENCE)
    expect(result.endBalance).toBe(198290.4)
    expect(result.totalContributions).toBe(120000)
    expect(result.totalInterest).toBe(58290.4)
  })

  it('keeps the three parts summing to the end balance', () => {
    const result = calculateEndAmount(REFERENCE)
    expect(result.startingAmount + result.totalContributions + result.totalInterest).toBeCloseTo(
      result.endBalance,
      2
    )
  })

  it('matches plain compound interest when there are no contributions', () => {
    const result = calculateEndAmount({ ...REFERENCE, compound: 'monthly', contribution: 0 })
    expect(result.endBalance).toBeCloseTo(20000 * (1 + 0.06 / 12) ** 120, 2)
    expect(result.totalContributions).toBe(0)
  })

  it('pays more when contributions land at the beginning of each period', () => {
    const atEnd = calculateEndAmount(REFERENCE).endBalance
    const atStart = calculateEndAmount({ ...REFERENCE, contributionTiming: 'beginning' }).endBalance
    expect(atStart).toBeGreaterThan(atEnd)
  })

  it('handles a zero return rate without dividing by zero', () => {
    const result = calculateEndAmount({ ...REFERENCE, returnRate: 0 })
    expect(result.endBalance).toBeCloseTo(20000 + 120000, 2)
    expect(result.totalInterest).toBeCloseTo(0, 2)
  })

  it('builds one schedule row per year, ending at the final balance', () => {
    const result = calculateEndAmount(REFERENCE)
    expect(result.schedule).toHaveLength(10)
    expect(result.schedule[9]!.endBalance).toBeCloseTo(result.endBalance, 2)
    expect(result.schedule[0]!.startBalance).toBe(20000)
  })
})

describe('solvers invert calculateEndAmount', () => {
  const target = calculateEndAmount(REFERENCE).endBalance

  it('recovers the contribution', () => {
    expect(solveContribution(REFERENCE, target)).toBeCloseTo(1000, 2)
  })

  it('recovers the starting amount', () => {
    expect(solveStartingAmount(REFERENCE, target)).toBeCloseTo(20000, 2)
  })

  it('recovers the return rate', () => {
    expect(solveReturnRate(REFERENCE, target)!).toBeCloseTo(6, 2)
  })

  it('recovers the investment length', () => {
    expect(solveYears(REFERENCE, target)!).toBeCloseTo(10, 1)
  })

  it('returns null when a target is unreachable in the search range', () => {
    expect(solveYears({ ...REFERENCE, contribution: 0, returnRate: 0 }, 1e9)).toBeNull()
  })

  it('reports zero years when the starting amount already clears the target', () => {
    expect(solveYears(REFERENCE, 15000)).toBe(0)
  })
})
