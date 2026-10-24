import type { ZodType } from 'zod'
import { noteSchema } from '~~/shared/schemas/notes'
import { journalEntrySchema, objectiveSchema } from '~~/shared/schemas/planner'
import { routineEntrySchema } from '~~/shared/schemas/routine'
import { shoppingItemSchema } from '~~/shared/schemas/shopping'
import { weighInSchema } from '~~/shared/schemas/stats'
import type { VoiceAction } from '~~/shared/utils/voice-commands'
import { useNotesRepository } from '~~/server/utils/notes-repository'
import { useRoutineRepository } from '~~/server/utils/routine-repository'
import { useShoppingRepository } from '~~/server/utils/shopping-repository'
import { useStatsRepository } from '~~/server/utils/stats-repository'

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'That command is not valid.' })
  }
  return parsed.data
}

/**
 * Runs a voice command for a user without a browser session (Alexa), doing
 * what the endpoint the command names would do: same schema, same
 * repository, same audit entry. Like the commands themselves, every action
 * only adds.
 */
export async function runVoiceAction(userId: string, action: VoiceAction, source: string) {
  const planner = usePlannerRepository()
  const audit = (entity: string, id: string, context: Record<string, unknown>) =>
    planner.createAuditEvent(userId, 'create', entity, id, { ...context, via: source })

  switch (action.endpoint) {
    case '/api/notes': {
      const record = await useNotesRepository().createNote(userId, parse(noteSchema, action.body))
      await audit('note', record.id, { source: record.source })
      return
    }
    case '/api/priorities': {
      const body = parse(objectiveSchema, action.body)
      const record = await planner.createObjective(userId, { ...body, scheduledFor: body.scheduledFor || null, dueDate: body.dueDate || null })
      await audit('objective', record.id, { title: record.title })
      return
    }
    case '/api/shopping/items': {
      const record = await useShoppingRepository().createItem(userId, parse(shoppingItemSchema, action.body))
      await audit('shopping-item', record.id, { name: record.name, horizon: record.horizon })
      return
    }
    case '/api/stats/weigh-ins': {
      const record = await useStatsRepository().saveWeighIn(userId, parse(weighInSchema, action.body))
      await audit('weigh-in', record.id, { weekKey: record.weekKey, weightKg: record.weightKg })
      return
    }
    case '/api/journal': {
      const record = await planner.createJournalEntry(userId, parse(journalEntrySchema, action.body))
      await audit('journal_entry', record.id, { title: record.title })
      return
    }
    case '/api/routine/entries': {
      const record = await useRoutineRepository().createTemplate(userId, parse(routineEntrySchema, action.body))
      await audit('routine-item', record.id, { description: record.description })
      return
    }
    default:
      throw createError({ statusCode: 400, statusMessage: `Voice commands cannot reach ${action.endpoint}.` })
  }
}
