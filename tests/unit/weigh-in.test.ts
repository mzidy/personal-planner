import { describe, expect, it } from 'vitest'
import {
  isPlausibleWeight,
  isoWeekStart,
  localNoonIso,
  parseWeight,
  todayIso,
  weighInWeek
} from '../../shared/utils/weigh-in'

describe('parseWeight', () => {
  it('accepts a comma as the decimal separator', () => {
    expect(parseWeight('85,4')).toBe(85.4)
    expect(parseWeight('85.4')).toBe(85.4)
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseWeight('  90  ')).toBe(90)
  })

  it('returns null for anything that is not a number', () => {
    expect(parseWeight('')).toBeNull()
    expect(parseWeight('   ')).toBeNull()
    expect(parseWeight('heavy')).toBeNull()
  })
})

describe('isPlausibleWeight', () => {
  it('accepts the range the API accepts', () => {
    expect(isPlausibleWeight(25)).toBe(true)
    expect(isPlausibleWeight(400)).toBe(true)
    expect(isPlausibleWeight(85.4)).toBe(true)
  })

  it('rejects values outside it, and null', () => {
    expect(isPlausibleWeight(24.9)).toBe(false)
    expect(isPlausibleWeight(401)).toBe(false)
    expect(isPlausibleWeight(null)).toBe(false)
  })
})

describe('localNoonIso', () => {
  it('lands at midday local, so the date cannot slip across the UTC boundary', () => {
    const iso = localNoonIso('2026-10-19')
    expect(iso).not.toBeNull()

    const back = new Date(iso!)
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(9)
    expect(back.getDate()).toBe(19)
    expect(back.getHours()).toBe(12)
  })

  it('keeps the calendar day whatever the offset', () => {
    // Midnight is what would break: in a negative-offset zone it converts to
    // the previous day. Noon has twelve hours of slack in either direction.
    for (const day of ['2026-01-05', '2026-06-15', '2026-12-28']) {
      const back = new Date(localNoonIso(day)!)
      expect(todayIso(back)).toBe(day)
    }
  })

  it('returns null for a malformed date', () => {
    expect(localNoonIso('')).toBeNull()
    expect(localNoonIso('not-a-date')).toBeNull()
  })
})

describe('isoWeekStart', () => {
  it('returns the Monday of that week', () => {
    // 2026-10-19 is a Monday.
    expect(isoWeekStart('2026-10-19')).toBe('2026-10-19')
    expect(isoWeekStart('2026-10-21')).toBe('2026-10-19')
  })

  it('treats Sunday as the end of the week, not the start', () => {
    // 2026-10-25 is a Sunday; its ISO week began on the 19th.
    expect(isoWeekStart('2026-10-25')).toBe('2026-10-19')
    expect(isoWeekStart('2026-10-26')).toBe('2026-10-26')
  })

  it('crosses a month boundary', () => {
    // 2026-11-01 is a Sunday, so its week started in October.
    expect(isoWeekStart('2026-11-01')).toBe('2026-10-26')
  })

  it('returns null for a malformed date', () => {
    expect(isoWeekStart('nope')).toBeNull()
  })
})

describe('todayIso', () => {
  it('formats a date as YYYY-MM-DD in local time', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
    expect(todayIso(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
  })
})

describe('weighInWeek', () => {
  const history = [{ weekKey: '2026-11-02' }]

  it('updates when any day of that week already has an entry', () => {
    // Monday and Sunday are the two ends of the same ISO week.
    expect(weighInWeek('2026-11-02', history)).toEqual({
      weekKey: '2026-11-02',
      logged: true,
      title: 'Update that week'
    })
    expect(weighInWeek('2026-11-08', history).logged).toBe(true)
  })

  it('logs a new entry in a week without one', () => {
    expect(weighInWeek('2026-11-09', history)).toEqual({
      weekKey: '2026-11-09',
      logged: false,
      title: 'Log a weigh-in'
    })
    expect(weighInWeek('2026-11-05', []).logged).toBe(false)
  })

  it('is not logged while the date is empty', () => {
    expect(weighInWeek('', history)).toEqual({ weekKey: null, logged: false, title: 'Log a weigh-in' })
  })
})
