import { z } from 'zod'
import { isGrowthStepKey } from '~~/shared/utils/growth-steps'

export const growthAnswerSchema = z.object({
  stepKey: z.string().refine(isGrowthStepKey, 'Unknown growth step.'),
  answer: z.string().max(4000)
})

export type GrowthAnswerInput = z.infer<typeof growthAnswerSchema>
