export type RoutineState = 'planned' | 'done' | 'partial' | 'missed'

export interface RoutineEntryRecord {
  id: string
  userId: string
  description: string
  entryDate: string
  state: RoutineState
  position: number
  createdAt: string
  updatedAt: string
}

export interface RoutineDay {
  entryDate: string
  label: string
  isToday: boolean
  entries: RoutineEntryRecord[]
  doneCount: number
  totalCount: number
}

export interface RoutineOverview {
  today: string
  todayEntries: RoutineEntryRecord[]
  history: RoutineDay[]
  totalEntries: number
  doneCount: number
  completionRate: number
  streakDays: number
}
