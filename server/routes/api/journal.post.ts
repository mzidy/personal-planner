import { journalEntrySchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = journalEntrySchema.parse(await readBody(event))
  const record = await usePlannerRepository().createJournalEntry(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'journal_entry', record.id, { title: record.title })
  return record
})
