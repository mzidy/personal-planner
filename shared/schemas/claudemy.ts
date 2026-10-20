import { z } from 'zod'

export const claudemyCourseSchema = z.object({
  topic: z.string().trim().min(2).max(160),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  lessonCount: z.coerce.number().int().min(4).max(20).default(12),
  /** Optional: build the class from this one person's published work. */
  person: z.string().trim().max(120).default('')
})

export const claudemyFeedbackSchema = z.object({
  feedback: z.string().trim().max(2000).default('')
})

export const claudemyProgressSchema = z.object({
  heard: z.boolean().optional(),
  tried: z.boolean().optional(),
  ruleKept: z.boolean().optional()
})
