import { z } from 'zod'

export const objectiveSchema = z.object({
  title: z.string().min(3).max(120),
  detail: z.string().min(3).max(400),
  status: z.enum(['focus', 'scheduled', 'delegated', 'backlog', 'done']).default('focus'),
  urgency: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  focusWindow: z.string().min(2).max(80).default('Morning deep work'),
  scheduledFor: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional()
})

export const objectiveUpdateSchema = objectiveSchema.partial()

export const timeBlockSchema = z.object({
  objectiveId: z.string().nullable().optional(),
  title: z.string().min(3).max(120),
  description: z.string().max(240).default(''),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  kind: z.enum(['meeting', 'focus', 'travel', 'admin']).default('focus'),
  tone: z.enum(['ink', 'teal', 'mist']).default('teal')
})

export const timeBlockUpdateSchema = timeBlockSchema.partial()

export const focusSessionSchema = z.object({
  objectiveId: z.string().nullable().optional(),
  title: z.string().min(3).max(120),
  plannedMinutes: z.number().int().min(15).max(480),
  actualMinutes: z.number().int().min(0).max(480),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime()
})

export const journalEntrySchema = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(6000),
  prompt: z.string().max(240).default(''),
  focusTag: z.string().max(80).default('Reflection')
})

export const journalEntryUpdateSchema = journalEntrySchema.partial()

export const goalAreaSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(3).max(240),
  currentPercent: z.number().int().min(0).max(100),
  targetPercent: z.number().int().min(0).max(100),
  tone: z.enum(['ink', 'teal', 'mist']).default('ink'),
  dueDate: z.string().datetime().nullable().optional()
})

export const goalAreaUpdateSchema = goalAreaSchema.partial()

export const financeTransactionSchema = z.object({
  accountId: z.string().min(2),
  categoryId: z.string().min(2),
  title: z.string().min(3).max(120),
  amount: z.number().positive(),
  direction: z.enum(['income', 'expense']),
  status: z.enum(['pending', 'verified']).default('verified'),
  occurredAt: z.string().datetime(),
  notes: z.string().max(240).default('')
})
