import { routineEntryPatchSchema } from '~~/shared/schemas/routine'
import { useRoutineRepository } from '~~/server/utils/routine-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const entryId = getRouterParam(event, 'id') || ''
  const body = routineEntryPatchSchema.parse(await readBody(event))
  const record = await useRoutineRepository().updateEntry(user.id, entryId, body)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Routine entry not found.' })
  }

  return record
})
