import { z } from 'zod'

export const routineStateSchema = z.enum(['planned', 'done', 'partial', 'missed'])

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')

export const routineEntrySchema = z.object({
  description: z.string().min(1).max(400),
  entryDate: isoDate.optional(),
  state: routineStateSchema.optional()
})

export const routineEntryPatchSchema = z.object({
  description: z.string().min(1).max(400).optional(),
  entryDate: isoDate.optional(),
  state: routineStateSchema.optional()
})

export type RoutineEntryInput = z.infer<typeof routineEntrySchema>
export type RoutineEntryPatch = z.infer<typeof routineEntryPatchSchema>
