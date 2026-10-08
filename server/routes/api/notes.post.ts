import { noteSchema } from '~~/shared/schemas/notes'
import { useNotesRepository } from '~~/server/utils/notes-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = await readValidatedBody(event, noteSchema.parse)
  const record = await useNotesRepository().createNote(user.id, body)

  await usePlannerRepository().createAuditEvent(user.id, 'create', 'note', record.id, {
    source: record.source
  })
  return record
})
