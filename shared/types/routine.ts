export type RoutineState = 'planned' | 'done' | 'partial' | 'missed'

/** A recurring routine item. It exists on every day, not just the day it was created. */
export interface RoutineTemplateRecord {
  id: string
  userId: string
  description: string
  position: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/** One routine item as it stands on a particular day. */
export interface RoutineDayItem {
  id: string
  templateId: string
  description: string
  position: number
  state: RoutineState
}

export interface RoutineDay {
  entryDate: string
  label: string
  isToday: boolean
  items: RoutineDayItem[]
  doneCount: number
  totalCount: number
}

export interface RoutineOverview {
  today: string
  /** Every active item, carrying today's state. */
  todayItems: RoutineDayItem[]
  /** Past days that have at least one recorded state, newest first. */
  history: RoutineDay[]
}
