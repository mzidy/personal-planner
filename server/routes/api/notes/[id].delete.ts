import { useNotesRepository } from '~~/server/utils/notes-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const record = await useNotesRepository().deleteNote(user.id, getRouterParam(event, 'id') || '')

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Note not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'note', record.id, {})
  return { ok: true }
})
