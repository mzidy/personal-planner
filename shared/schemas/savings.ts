import { z } from 'zod'

export const savingsGoalSchema = z.object({
  title: z.string().trim().min(1, 'Give the goal a name.').max(60, 'Keep the name under 60 characters.'),
  targetAmount: z.number().finite().positive('The target has to be above zero.').max(1_000_000),
  savedAmount: z.number().finite().min(0, 'Saved cannot be negative.').max(1_000_000),
  weeklyAllowance: z.number().finite().positive('The allowance has to be above zero, or empty.').max(100_000).nullable().default(null)
})

export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>
