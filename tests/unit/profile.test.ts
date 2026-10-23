import { describe, expect, it } from 'vitest'
import { statsProfileSchema } from '../../shared/schemas/stats'
import { ageOn, birthDateProblem, isCalendarDate } from '../../shared/utils/profile'

describe('ageOn', () => {
  it('counts whole years, turning a year older on the birthday itself', () => {
    expect(ageOn('1990-10-23', '2026-10-22')).toBe(35)
    expect(ageOn('1990-10-23', '2026-10-23')).toBe(36)
    expect(ageOn('1990-12-31', '2026-01-01')).toBe(35)
  })

  it('moves a 29 February birthday to 1 March in common years', () => {
    expect(ageOn('2004-02-29', '2025-02-28')).toBe(20)
    expect(ageOn('2004-02-29', '2025-03-01')).toBe(21)
    expect(ageOn('2004-02-29', '2028-02-29')).toBe(24)
  })
})

describe('birth dates', () => {
  it('accepts only real calendar dates', () => {
    expect(isCalendarDate('2000-02-29')).toBe(true)
    expect(isCalendarDate('2001-02-29')).toBe(false)
    expect(isCalendarDate('1990-13-01')).toBe(false)
    expect(isCalendarDate('14.05.1990')).toBe(false)
  })

  it('refuses the future, under-13s and impossible ages', () => {
    expect(birthDateProblem('1990-05-14', '2026-10-23')).toBeNull()
    expect(birthDateProblem('2026-10-24', '2026-10-23')).toBe('The date of birth cannot be in the future.')
    expect(birthDateProblem('2013-10-24', '2026-10-23')).toBe('The minimum age is 13.')
    expect(birthDateProblem('2013-10-23', '2026-10-23')).toBeNull()
    expect(birthDateProblem('1900-01-01', '2026-10-23')).toBe('Check the year of birth.')
  })
})

describe('statsProfileSchema', () => {
  it('lets gender and date of birth be cleared or left out', () => {
    expect(statsProfileSchema.safeParse({ gender: null, birthDate: null }).success).toBe(true)
    expect(statsProfileSchema.safeParse({ heightCm: 180 }).success).toBe(true)
    expect(statsProfileSchema.safeParse({ gender: 'female', birthDate: '1990-05-14' }).success).toBe(true)
    expect(statsProfileSchema.safeParse({ gender: 'x' }).success).toBe(false)
  })
})
