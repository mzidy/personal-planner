import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')

export const portfolioRuleSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(600).optional(),
  dateSet: isoDate.optional(),
  isIndex: z.boolean().optional(),
  geo: z.string().max(80).optional()
})

export const portfolioRulePatchSchema = portfolioRuleSchema.partial()

export type PortfolioRuleInput = z.infer<typeof portfolioRuleSchema>
export type PortfolioRulePatch = z.infer<typeof portfolioRulePatchSchema>
