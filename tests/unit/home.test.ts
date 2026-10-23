import { describe, expect, it } from 'vitest'
import { dueOrder, dueTag, euros, firstName, partOfDay, savingsNote, savingsProgress, studyDays, studyStreak, studySummary } from '../../shared/utils/home'
import { isThemeChoice, themeForProfile } from '../../shared/utils/themes'

const TODAY = '2026-10-23' // a Friday

describe('themeForProfile', () => {
  it('picks the design for each audience', () => {
    expect(themeForProfile('female', '2012-05-01', TODAY)).toBe('chrome')
    expect(themeForProfile('male', '2012-05-01', TODAY)).toBe('skate')
    expect(themeForProfile('female', '1990-05-01', TODAY)).toBe('lavender')
    expect(themeForProfile('male', '1990-05-01', TODAY)).toBe('graphite')
  })

  it('turns 18 on the birthday itself', () => {
    expect(themeForProfile('male', '2008-10-24', TODAY)).toBe('skate')
    expect(themeForProfile('male', '2008-10-23', TODAY)).toBe('graphite')
  })

  it('keeps the original look without a gender, and treats a missing birth date as adult', () => {
    expect(themeForProfile(null, '2012-05-01', TODAY)).toBe('executive')
    expect(themeForProfile('other', '2012-05-01', TODAY)).toBe('executive')
    expect(themeForProfile('unspecified', null, TODAY)).toBe('executive')
    expect(themeForProfile('female', null, TODAY)).toBe('lavender')
  })

  it('knows a valid switch value', () => {
    expect(isThemeChoice('auto')).toBe(true)
    expect(isThemeChoice('skate')).toBe(true)
    expect(isThemeChoice('neon')).toBe(false)
    expect(isThemeChoice(undefined)).toBe(false)
  })
})

describe('greeting', () => {
  it('uses the first name and the part of the day', () => {
    expect(firstName('Nika Novak')).toBe('Nika')
    expect(firstName('  ')).toBe('there')
    expect([partOfDay(6), partOfDay(12), partOfDay(17), partOfDay(18)]).toEqual(['morning', 'afternoon', 'afternoon', 'evening'])
  })
})

describe('study streak', () => {
  const sessions = [
    { dayKey: '2026-10-23', actualMinutes: 30 },
    { dayKey: '2026-10-23', actualMinutes: 20 },
    { dayKey: '2026-10-22', actualMinutes: 40 },
    { dayKey: '2026-10-21', actualMinutes: 10 },
    { dayKey: '2026-10-19', actualMinutes: 60 },
    { dayKey: '2026-10-12', actualMinutes: 70 }
  ]

  it('adds up each day of the last two weeks, oldest first', () => {
    const days = studyDays(sessions, TODAY)
    expect(days).toHaveLength(14)
    expect(days[0]).toEqual({ day: '2026-10-10', minutes: 0 })
    expect(days[2]).toEqual({ day: '2026-10-12', minutes: 70 })
    expect(days[13]).toEqual({ day: TODAY, minutes: 50 })
  })

  it('counts days in a row, and does not break on a today that has not happened yet', () => {
    expect(studyStreak(sessions, TODAY)).toBe(3)
    expect(studyStreak(sessions, '2026-10-24')).toBe(3)
    expect(studyStreak(sessions, '2026-10-25')).toBe(0)
  })

  it('averages the last seven days and compares them with the seven before', () => {
    const days = studyDays(sessions, TODAY)
    // This week: 50 + 40 + 10 + 60 = 160 over 7 days; the week before: 70.
    expect(studySummary(days)).toEqual({ averageMinutes: 23, changePercent: 129 })
    expect(studySummary(studyDays([{ dayKey: TODAY, actualMinutes: 14 }], TODAY))).toEqual({ averageMinutes: 2, changePercent: null })
  })
})

describe('dueTag', () => {
  it('labels homework by how soon it is due', () => {
    expect(dueTag(null, TODAY)).toEqual({ label: 'WHENEVER', tone: 'calm' })
    expect(dueTag('2026-10-22', TODAY)).toEqual({ label: 'LATE', tone: 'urgent' })
    expect(dueTag('2026-10-23T09:00:00.000Z', TODAY)).toEqual({ label: 'TODAY', tone: 'urgent' })
    expect(dueTag('2026-10-26', TODAY)).toEqual({ label: 'DUE MON', tone: 'urgent' })
    expect(dueTag('2026-10-29', TODAY)).toEqual({ label: 'THIS WEEK', tone: 'week' })
    expect(dueTag('2026-11-10', TODAY)).toEqual({ label: 'SOON', tone: 'calm' })
    expect(dueTag('2026-12-24', TODAY)).toEqual({ label: 'WHENEVER', tone: 'calm' })
  })

  it('sorts undated homework last', () => {
    const items = [null, '2026-11-01', '2026-10-25'].sort((a, b) => dueOrder(a) - dueOrder(b))
    expect(items).toEqual(['2026-10-25', '2026-11-01', null])
  })
})

describe('savingsProgress', () => {
  it('shows how far along a goal is and how many weeks of allowance are left', () => {
    expect(savingsProgress({ targetAmount: 120, savedAmount: 42, weeklyAllowance: 13 })).toEqual({ percent: 35, remaining: 78, weeksLeft: 6 })
    expect(savingsProgress({ targetAmount: 120, savedAmount: 150, weeklyAllowance: 10 })).toEqual({ percent: 100, remaining: 0, weeksLeft: 0 })
    expect(savingsProgress({ targetAmount: 50, savedAmount: 10, weeklyAllowance: null }).weeksLeft).toBeNull()
  })
  it('words the line under the bar', () => {
    expect(euros(42)).toBe('€42')
    expect(euros(12.5)).toBe('€12.50')
    expect(savingsNote(savingsProgress({ targetAmount: 120, savedAmount: 42, weeklyAllowance: 13 }))).toBe('€78 to go · about 6 more weeks of allowance')
    expect(savingsNote(savingsProgress({ targetAmount: 120, savedAmount: 110, weeklyAllowance: 10 }))).toBe('€10 to go · about 1 more week of allowance')
    expect(savingsNote(savingsProgress({ targetAmount: 120, savedAmount: 20, weeklyAllowance: null }))).toBe('€100 to go')
    expect(savingsNote(savingsProgress({ targetAmount: 120, savedAmount: 120, weeklyAllowance: 5 }))).toBe('Goal reached — time to spend it')
  })
})
