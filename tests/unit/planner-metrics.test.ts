import { describe, expect, it } from 'vitest'
import {
  calculateBudgetHealth,
  calculateCompletionRate,
  calculateSavingsRate
} from '../../shared/utils/planner-metrics'

describe('planner metrics', () => {
  it('calculates completion rate safely', () => {
    expect(calculateCompletionRate(0, 0)).toBe(0)
    expect(calculateCompletionRate(5, 4)).toBe(80)
  })

  it('calculates savings rate from income and spend', () => {
    expect(calculateSavingsRate(0, 100)).toBe(0)
    expect(calculateSavingsRate(2000, 500)).toBe(75)
  })

  it('calculates budget health from a spending threshold', () => {
    expect(calculateBudgetHealth(undefined, 500)).toBe(82)
    expect(calculateBudgetHealth(1000, 400)).toBe(60)
  })
})
