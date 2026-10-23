/**
 * The arithmetic behind the themed home pages, kept pure so it can be tested
 * and shared by every design.
 */

const DAY_MS = 86_400_000

function addDays(day: string, delta: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10)
}

function daysFrom(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/** "Nika Novak" → "Nika". */
export function firstName(displayName: string | null | undefined) {
  return (displayName || '').trim().split(/\s+/)[0] || 'there'
}

/** Good morning until noon, afternoon until six, evening after. */
export function partOfDay(hour: number) {
  if (hour < 12) {
    return 'morning'
  }
  return hour < 18 ? 'afternoon' : 'evening'
}

export interface StudyDay {
  day: string
  minutes: number
}

/** Minutes studied on each of the `count` days ending today, oldest first. */
export function studyDays(sessions: { dayKey: string; actualMinutes: number }[], today: string, count = 14): StudyDay[] {
  const totals = new Map<string, number>()
  for (const session of sessions) {
    totals.set(session.dayKey, (totals.get(session.dayKey) ?? 0) + Math.max(0, session.actualMinutes))
  }
  return Array.from({ length: count }, (_, index) => {
    const day = addDays(today, index - count + 1)
    return { day, minutes: totals.get(day) ?? 0 }
  })
}

/**
 * Days in a row with some study, counting back from today. A day that has not
 * been studied yet does not break the run until it is over, so the streak
 * counts from yesterday while today is still empty.
 */
export function studyStreak(sessions: { dayKey: string; actualMinutes: number }[], today: string) {
  const studied = new Set(sessions.filter(session => session.actualMinutes > 0).map(session => session.dayKey))
  let day = studied.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (studied.has(day)) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}

export interface StudySummary {
  /** Average over the last seven days, today included. */
  averageMinutes: number
  /** Against the seven days before; null when there was nothing to compare with. */
  changePercent: number | null
}

export function studySummary(days: StudyDay[]): StudySummary {
  const thisWeek = days.slice(-7).reduce((sum, item) => sum + item.minutes, 0)
  const lastWeek = days.slice(-14, -7).reduce((sum, item) => sum + item.minutes, 0)
  return {
    averageMinutes: Math.round(thisWeek / 7),
    changePercent: lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null
  }
}

export type DueTone = 'urgent' | 'week' | 'calm'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/**
 * How soon a piece of homework is due, as the designs label it: late or
 * within three days by name (DUE MON), within a week THIS WEEK, within three
 * weeks SOON, and anything later or undated WHENEVER.
 */
export function dueTag(dueDate: string | null | undefined, today: string): { label: string; tone: DueTone } {
  if (!dueDate) {
    return { label: 'WHENEVER', tone: 'calm' }
  }
  const day = dueDate.slice(0, 10)
  const days = daysFrom(today, day)
  if (days < 0) {
    return { label: 'LATE', tone: 'urgent' }
  }
  if (days === 0) {
    return { label: 'TODAY', tone: 'urgent' }
  }
  if (days <= 3) {
    return { label: `DUE ${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]}`, tone: 'urgent' }
  }
  if (days <= 7) {
    return { label: 'THIS WEEK', tone: 'week' }
  }
  if (days <= 21) {
    return { label: 'SOON', tone: 'calm' }
  }
  return { label: 'WHENEVER', tone: 'calm' }
}

/** Sort key for homework: soonest due first, undated last. */
export function dueOrder(dueDate: string | null | undefined) {
  return dueDate ? Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`) : Number.POSITIVE_INFINITY
}

export interface SavingsProgress {
  percent: number
  remaining: number
  /** Weeks of allowance still needed; null without an allowance. */
  weeksLeft: number | null
}

export function savingsProgress(goal: { targetAmount: number; savedAmount: number; weeklyAllowance: number | null }): SavingsProgress {
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)
  const percent = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0
  const weeksLeft = goal.weeklyAllowance && goal.weeklyAllowance > 0 ? Math.ceil(remaining / goal.weeklyAllowance) : null
  return { percent, remaining, weeksLeft }
}

/** €42, or €42.50 when there are cents. */
export function euros(amount: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount)
}

/** "€78 to go · about 6 more weeks of allowance", as under the goal's bar. */
export function savingsNote(progress: SavingsProgress) {
  if (progress.remaining <= 0) {
    return 'Goal reached — time to spend it'
  }
  const toGo = `${euros(progress.remaining)} to go`
  if (progress.weeksLeft === null) {
    return toGo
  }
  return `${toGo} · about ${progress.weeksLeft} more ${progress.weeksLeft === 1 ? 'week' : 'weeks'} of allowance`
}
