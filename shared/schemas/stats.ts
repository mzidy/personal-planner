import { z } from 'zod'

export const statsProfileSchema = z.object({
  heightCm: z.number().min(80).max(260).nullable().optional(),
  targetWeightKg: z.number().min(25).max(400).nullable().optional()
})

export const weighInSchema = z.object({
  weightKg: z.number().min(25).max(400),
  bodyFatPercent: z.number().min(2).max(70).nullable().optional(),
  notes: z.string().max(240).optional(),
  measuredAt: z.string().datetime().optional()
})

export type StatsProfileInput = z.infer<typeof statsProfileSchema>
export type WeighInInput = z.infer<typeof weighInSchema>
