export interface SavingsGoalRecord {
  id: string
  title: string
  targetAmount: number
  savedAmount: number
  /** Pocket money per week, used to say how many weeks are left. */
  weeklyAllowance: number | null
  updatedAt: string
}
