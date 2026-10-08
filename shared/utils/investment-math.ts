/**
 * Compound-interest maths for the investment calculator.
 *
 * Convention: the nominal annual return is compounded at the chosen frequency
 * to an effective annual rate, and contributions are then grown at the
 * equivalent rate for their own period. That is what lets you compound
 * annually while contributing monthly without the two schedules disagreeing.
 *
 * Pure functions only — no I/O — so the solvers can be unit tested directly.
 */

export type CompoundFrequency =
  | 'annually'
  | 'semiannually'
  | 'quarterly'
  | 'monthly'
  | 'semimonthly'
  | 'biweekly'
  | 'weekly'
  | 'daily'

export type ContributionFrequency = 'month' | 'year'
export type ContributionTiming = 'beginning' | 'end'

export const COMPOUND_PERIODS: Record<CompoundFrequency, number> = {
  annually: 1,
  semiannually: 2,
  quarterly: 4,
  monthly: 12,
  semimonthly: 24,
  biweekly: 26,
  weekly: 52,
  daily: 365
}

export const COMPOUND_LABELS: Record<CompoundFrequency, string> = {
  annually: 'annually',
  semiannually: 'semiannually',
  quarterly: 'quarterly',
  monthly: 'monthly',
  semimonthly: 'semimonthly',
  biweekly: 'biweekly',
  weekly: 'weekly',
  daily: 'daily'
}

export interface InvestmentInputs {
  startingAmount: number
  years: number
  /** Nominal annual return, in percent. */
  returnRate: number
  compound: CompoundFrequency
  contribution: number
  contributionFrequency: ContributionFrequency
  contributionTiming: ContributionTiming
}

export interface InvestmentResult {
  endBalance: number
  startingAmount: number
  totalContributions: number
  totalInterest: number
  /** Balance at the end of each year, for the schedule and the chart. */
  schedule: {
    year: number
    startBalance: number
    contributions: number
    interest: number
    endBalance: number
  }[]
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Effective annual rate implied by a nominal rate compounded `periods` times a year. */
export function effectiveAnnualRate(returnRatePercent: number, compound: CompoundFrequency) {
  const periods = COMPOUND_PERIODS[compound]
  const nominal = returnRatePercent / 100
  return (1 + nominal / periods) ** periods - 1
}

/** Rate for one contribution period, derived from the effective annual rate. */
export function periodRate(returnRatePercent: number, compound: CompoundFrequency, frequency: ContributionFrequency) {
  const effective = effectiveAnnualRate(returnRatePercent, compound)
  const perYear = frequency === 'month' ? 12 : 1
  return (1 + effective) ** (1 / perYear) - 1
}

/** Future value of a stream of `n` equal payments at rate `i`. */
function annuityFactor(i: number, n: number, timing: ContributionTiming) {
  if (n <= 0) {
    return 0
  }
  const ordinary = i === 0 ? n : ((1 + i) ** n - 1) / i
  return timing === 'beginning' ? ordinary * (1 + i) : ordinary
}

export function calculateEndAmount(inputs: InvestmentInputs): InvestmentResult {
  const perYear = inputs.contributionFrequency === 'month' ? 12 : 1
  const i = periodRate(inputs.returnRate, inputs.compound, inputs.contributionFrequency)

  const schedule: InvestmentResult['schedule'] = []
  let balance = inputs.startingAmount
  const wholeYears = Math.max(0, Math.floor(inputs.years))

  for (let year = 1; year <= wholeYears; year += 1) {
    const startBalance = balance
    const grown = startBalance * (1 + i) ** perYear
    const contributed = inputs.contribution * perYear
    const fromContributions = inputs.contribution * annuityFactor(i, perYear, inputs.contributionTiming)

    balance = grown + fromContributions
    schedule.push({
      year,
      startBalance: round(startBalance),
      contributions: round(contributed),
      interest: round(balance - startBalance - contributed),
      endBalance: round(balance)
    })
  }

  // Closed form over the full (possibly fractional) term, so the headline figure
  // does not drift from the year-by-year loop above.
  const n = inputs.years * perYear
  const endBalance =
    inputs.startingAmount * (1 + i) ** n +
    inputs.contribution * annuityFactor(i, n, inputs.contributionTiming)
  const totalContributions = inputs.contribution * n

  return {
    endBalance: round(endBalance),
    startingAmount: round(inputs.startingAmount),
    totalContributions: round(totalContributions),
    totalInterest: round(endBalance - inputs.startingAmount - totalContributions),
    schedule
  }
}

/** Contribution per period needed to reach `target`. */
export function solveContribution(inputs: InvestmentInputs, target: number) {
  const perYear = inputs.contributionFrequency === 'month' ? 12 : 1
  const i = periodRate(inputs.returnRate, inputs.compound, inputs.contributionFrequency)
  const n = inputs.years * perYear
  const factor = annuityFactor(i, n, inputs.contributionTiming)

  if (factor === 0) {
    return null
  }
  return round((target - inputs.startingAmount * (1 + i) ** n) / factor)
}

/** Starting amount needed to reach `target`. */
export function solveStartingAmount(inputs: InvestmentInputs, target: number) {
  const perYear = inputs.contributionFrequency === 'month' ? 12 : 1
  const i = periodRate(inputs.returnRate, inputs.compound, inputs.contributionFrequency)
  const n = inputs.years * perYear
  const growth = (1 + i) ** n

  if (growth === 0) {
    return null
  }
  return round((target - inputs.contribution * annuityFactor(i, n, inputs.contributionTiming)) / growth)
}

/**
 * Nominal annual return needed to reach `target`, found by bisection.
 * There is no closed form once regular contributions are involved.
 */
export function solveReturnRate(inputs: InvestmentInputs, target: number) {
  const balanceAt = (ratePercent: number) =>
    calculateEndAmount({ ...inputs, returnRate: ratePercent }).endBalance

  let low = -99
  let high = 100

  // The result must be bracketed for bisection to mean anything.
  if (balanceAt(low) > target || balanceAt(high) < target) {
    return null
  }

  for (let step = 0; step < 200; step += 1) {
    const mid = (low + high) / 2
    if (balanceAt(mid) < target) {
      low = mid
    } else {
      high = mid
    }
  }

  return round((low + high) / 2, 3)
}

/** Years needed to reach `target`, found by bisection over the term. */
export function solveYears(inputs: InvestmentInputs, target: number) {
  const balanceAt = (years: number) => calculateEndAmount({ ...inputs, years }).endBalance

  if (balanceAt(0) >= target) {
    return 0
  }

  let low = 0
  let high = 200

  if (balanceAt(high) < target) {
    return null
  }

  for (let step = 0; step < 200; step += 1) {
    const mid = (low + high) / 2
    if (balanceAt(mid) < target) {
      low = mid
    } else {
      high = mid
    }
  }

  return round((low + high) / 2, 2)
}
