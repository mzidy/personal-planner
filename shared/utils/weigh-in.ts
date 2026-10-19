/**
 * Shared bits of the weigh-in forms. Both the dashboard prompt and the stats
 * page take a date and a weight, and both have to agree about what week that
 * lands in and what counts as a number.
 */

/** Today as YYYY-MM-DD in local time, which is what a date input expects. */
export function todayIso(now = new Date()) {
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/**
 * A comma is the decimal separator on a Slovenian keyboard, and `type="number"`
 * silently discards a value containing one. The forms use a text input and
 * parse here instead.
 */
export function parseWeight(input: string): number | null {
  const raw = input.trim().replace(',', '.')
  if (!raw) {
    return null
  }
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export const MIN_WEIGHT_KG = 25
export const MAX_WEIGHT_KG = 400

export function isPlausibleWeight(value: number | null): value is number {
  return value !== null && value >= MIN_WEIGHT_KG && value <= MAX_WEIGHT_KG
}

/**
 * Midday on the given date, as an ISO timestamp.
 *
 * The API derives the ISO week from this timestamp. Midnight is the obvious
 * choice and the wrong one: converted to UTC it lands on the previous day west
 * of Greenwich, so a Monday weigh-in would be filed under the week before.
 * Noon is clear of the boundary in either direction.
 */
export function localNoonIso(dateIso: string): string | null {
  const [year, month, day] = dateIso.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** The Monday of the ISO week containing the given date, as YYYY-MM-DD. */
export function isoWeekStart(dateIso: string): string | null {
  const [year, month, day] = dateIso.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  // getDay() is 0 on Sunday; ISO weeks start on Monday and end on Sunday.
  const weekday = date.getDay() || 7
  date.setDate(date.getDate() - (weekday - 1))

  return todayIso(date)
}
