export interface StatsProfileRecord {
  id: string
  userId: string
  heightCm: number | null
  targetWeightKg: number | null
  createdAt: string
  updatedAt: string
}

export interface WeighInRecord {
  id: string
  userId: string
  weekKey: string
  weightKg: number
  bodyFatPercent: number | null
  notes: string
  measuredAt: string
  createdAt: string
  updatedAt: string
}

export interface WeeklyPoint {
  weekKey: string
  label: string
  weightKg: number | null
  bodyFatPercent: number | null
}

export interface StatsOverview {
  profile: StatsProfileRecord | null
  currentWeightKg: number | null
  previousWeightKg: number | null
  weekChangeKg: number | null
  twelveWeekChangeKg: number | null
  bmi: number | null
  bmiLabel: string | null
  targetDeltaKg: number | null
  currentWeekKey: string
  currentWeekLogged: boolean
  streakWeeks: number
  series: WeeklyPoint[]
  history: WeighInRecord[]
}
