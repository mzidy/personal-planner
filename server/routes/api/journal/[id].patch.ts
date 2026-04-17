import { journalEntryUpdateSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const patch = journalEntryUpdateSchema.parse(await readBody(event))
  const record = await usePlannerRepository().updateJournalEntry(user.id, getRouterParam(event, 'id') || '', patch)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Journal entry not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'update', 'journal_entry', record.id, patch)
  return record
})
