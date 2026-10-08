import { useNotesRepository } from '~~/server/utils/notes-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return { notes: await useNotesRepository().listNotes(user.id) }
})
