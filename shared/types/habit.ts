export type HabitPlanStatus = 'draft' | 'active' | 'archived'

export interface HabitPlanRecord {
  id: string
  userId: string
  title: string
  answers: Record<string, string>
  status: HabitPlanStatus
  createdAt: string
  updatedAt: string
}

export interface HabitPlansPayload {
  plans: HabitPlanRecord[]
}
