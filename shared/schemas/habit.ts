import { z } from 'zod'
import { isHabitWizardFieldKey } from '~~/shared/utils/habit-wizard'

/** Only keys the wizard actually defines are accepted, so the blob cannot drift. */
const answers = z
  .record(z.string(), z.string().max(2000))
  .refine(
    value => Object.keys(value).every(isHabitWizardFieldKey),
    'Unknown wizard field.'
  )

export const habitPlanSchema = z.object({
  answers,
  status: z.enum(['draft', 'active', 'archived']).optional()
})

export const habitPlanPatchSchema = habitPlanSchema.partial()

export type HabitPlanInput = z.infer<typeof habitPlanSchema>
export type HabitPlanPatch = z.infer<typeof habitPlanPatchSchema>
