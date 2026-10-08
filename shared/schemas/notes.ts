import { z } from 'zod'

export const noteSchema = z.object({
  body: z.string().trim().min(1, 'A note needs some text.').max(20000),
  source: z.enum(['manual', 'import']).optional(),
  sourceName: z.string().max(200).optional(),
  // Bounded so a pathological OCR result cannot store an enormous grid.
  tableRows: z
    .array(z.array(z.string().max(2000)).max(50))
    .max(500)
    .nullable()
    .optional()
})

export const notePatchSchema = noteSchema.partial()

export type NoteInput = z.infer<typeof noteSchema>
export type NotePatch = z.infer<typeof notePatchSchema>
