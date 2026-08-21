import { and, asc, desc, eq } from 'drizzle-orm'
import { addWeeks, format, parseISO, startOfISOWeek, subWeeks } from 'date-fns'
import type { StatsOverview, StatsProfileRecord, WeeklyPoint, WeighInRecord } from '~~/shared/types/stats'
import type { StatsProfileInput, WeighInInput } from '~~/shared/schemas/stats'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

export const WEEKS_SHOWN = 12

function nowIso() {
  return new Date().toISOString()
}

/** Week key is the ISO-week Monday, e.g. 2026-07-27 — sortable and free of week-year edge cases. */
export function weekKeyOf(date: Date | string = new Date()) {
  const value = typeof date === 'string' ? parseISO(date) : date
  return format(startOfISOWeek(value), 'yyyy-MM-dd')
}

function weekLabel(weekKey: string) {
  return format(parseISO(weekKey), 'MMM d')
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function bmiLabelFor(bmi: number) {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Healthy range'
  if (bmi < 30) return 'Overweight'
  return 'Obese'
}

export function useStatsRepository() {
  return {
    async getProfile(userId: string): Promise<StatsProfileRecord | null> {
      const db = useDatabase()
      const [profile] = await db
        .select()
        .from(tables.statsProfiles)
        .where(eq(tables.statsProfiles.userId, userId))
        .limit(1)
      return (profile as StatsProfileRecord | undefined) || null
    },

    async saveProfile(userId: string, input: StatsProfileInput): Promise<StatsProfileRecord> {
      const db = useDatabase()
      const existing = await this.getProfile(userId)
      const timestamp = nowIso()

      if (existing) {
        const patch = {
          heightCm: input.heightCm === undefined ? existing.heightCm : input.heightCm,
          targetWeightKg: input.targetWeightKg === undefined ? existing.targetWeightKg : input.targetWeightKg,
          updatedAt: timestamp
        }
        await db.update(tables.statsProfiles).set(patch).where(eq(tables.statsProfiles.id, existing.id))
        return { ...existing, ...patch }
      }

      const record: StatsProfileRecord = {
        id: createId('stats'),
        userId,
        heightCm: input.heightCm ?? null,
        targetWeightKg: input.targetWeightKg ?? null,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      await db.insert(tables.statsProfiles).values(record)
      return record
    },

    async listWeighIns(userId: string): Promise<WeighInRecord[]> {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.weighIns)
        .where(eq(tables.weighIns.userId, userId))
        .orderBy(desc(tables.weighIns.weekKey))) as WeighInRecord[]
    },

    /** One weigh-in per ISO week: logging again in the same week updates that week's entry. */
    async saveWeighIn(userId: string, input: WeighInInput): Promise<WeighInRecord> {
      const db = useDatabase()
      const measuredAt = input.measuredAt || nowIso()
      const weekKey = weekKeyOf(measuredAt)
      const timestamp = nowIso()

      const [existing] = (await db
        .select()
        .from(tables.weighIns)
        .where(and(eq(tables.weighIns.userId, userId), eq(tables.weighIns.weekKey, weekKey)))
        .limit(1)) as WeighInRecord[]

      if (existing) {
        const patch = {
          weightKg: input.weightKg,
          bodyFatPercent: input.bodyFatPercent ?? null,
          notes: input.notes || '',
          measuredAt,
          updatedAt: timestamp
        }
        await db.update(tables.weighIns).set(patch).where(eq(tables.weighIns.id, existing.id))
        return { ...existing, ...patch }
      }

      const record: WeighInRecord = {
        id: createId('weigh'),
        userId,
        weekKey,
        weightKg: input.weightKg,
        bodyFatPercent: input.bodyFatPercent ?? null,
        notes: input.notes || '',
        measuredAt,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      await db.insert(tables.weighIns).values(record)
      return record
    },

    async deleteWeighIn(userId: string, weighInId: string) {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.weighIns)
        .where(and(eq(tables.weighIns.userId, userId), eq(tables.weighIns.id, weighInId)))
        .limit(1)) as WeighInRecord[]

      if (!record) {
        return null
      }

      await db.delete(tables.weighIns).where(eq(tables.weighIns.id, weighInId))
      return record
    },

    async getOverview(userId: string): Promise<StatsOverview> {
      const db = useDatabase()
      const profile = await this.getProfile(userId)
      const weighIns = (await db
        .select()
        .from(tables.weighIns)
        .where(eq(tables.weighIns.userId, userId))
        .orderBy(asc(tables.weighIns.weekKey))) as WeighInRecord[]

      const byWeek = new Map(weighIns.map(item => [item.weekKey, item]))
      const currentWeekKey = weekKeyOf()
      const firstWeek = subWeeks(parseISO(currentWeekKey), WEEKS_SHOWN - 1)

      const series: WeeklyPoint[] = Array.from({ length: WEEKS_SHOWN }, (_, index) => {
        const key = format(addWeeks(firstWeek, index), 'yyyy-MM-dd')
        const entry = byWeek.get(key)
        return {
          weekKey: key,
          label: weekLabel(key),
          weightKg: entry ? entry.weightKg : null,
          bodyFatPercent: entry?.bodyFatPercent ?? null
        }
      })

      const logged = series.filter(point => point.weightKg !== null)
      const currentWeightKg = weighIns.length ? weighIns[weighIns.length - 1]!.weightKg : null
      const previousWeightKg = weighIns.length > 1 ? weighIns[weighIns.length - 2]!.weightKg : null

      const weekChangeKg =
        currentWeightKg !== null && previousWeightKg !== null ? round(currentWeightKg - previousWeightKg) : null
      const twelveWeekChangeKg =
        logged.length > 1 ? round(logged[logged.length - 1]!.weightKg! - logged[0]!.weightKg!) : null

      let bmi: number | null = null
      if (profile?.heightCm && currentWeightKg !== null) {
        const heightM = profile.heightCm / 100
        bmi = round(currentWeightKg / (heightM * heightM))
      }

      const targetDeltaKg =
        profile?.targetWeightKg != null && currentWeightKg !== null
          ? round(currentWeightKg - profile.targetWeightKg)
          : null

      // Consecutive logged weeks ending at the most recent logged week.
      let streakWeeks = 0
      for (let index = series.length - 1; index >= 0; index -= 1) {
        const point = series[index]!
        if (point.weightKg !== null) {
          streakWeeks += 1
        } else if (streakWeeks > 0 || point.weekKey !== currentWeekKey) {
          break
        }
      }

      return {
        profile,
        currentWeightKg,
        previousWeightKg,
        weekChangeKg,
        twelveWeekChangeKg,
        bmi,
        bmiLabel: bmi === null ? null : bmiLabelFor(bmi),
        targetDeltaKg,
        currentWeekKey,
        currentWeekLogged: byWeek.has(currentWeekKey),
        streakWeeks,
        series,
        history: [...weighIns].reverse()
      }
    }
  }
}
