/** The choices offered for gender; "unspecified" is an answer, not a missing one. */
export const GENDERS = ['female', 'male', 'other', 'unspecified'] as const
export type Gender = (typeof GENDERS)[number]

export const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  unspecified: 'Prefer not to say'
}

/** The youngest and oldest ages accepted at registration. */
export const MIN_AGE = 13
export const MAX_AGE = 120

/** Today as YYYY-MM-DD in UTC. */
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Whole years from a YYYY-MM-DD birth date to `on`. Someone born on 29
 * February turns a year older on 1 March in common years.
 */
export function ageOn(birthDate: string, on = todayIso()) {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number]
  const [y, m, d] = on.split('-').map(Number) as [number, number, number]
  const hadBirthday = m > bm || (m === bm && d >= bd)
  return y - by - (hadBirthday ? 0 : 1)
}

/** A real calendar date, so 2001-02-30 is refused rather than rolled into March. */
export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Why a birth date is not accepted, or null when it is. */
export function birthDateProblem(value: string, on = todayIso()) {
  if (!isCalendarDate(value)) {
    return 'Enter the date of birth as a real date.'
  }
  if (value > on) {
    return 'The date of birth cannot be in the future.'
  }
  const age = ageOn(value, on)
  if (age < MIN_AGE) {
    return `The minimum age is ${MIN_AGE}.`
  }
  if (age > MAX_AGE) {
    return 'Check the year of birth.'
  }
  return null
}
