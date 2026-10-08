import { routineEntryPatchSchema } from '~~/shared/schemas/routine'
import { useRoutineRepository } from '~~/server/utils/routine-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const templateId = getRouterParam(event, 'id') || ''
  const body = routineEntryPatchSchema.parse(await readBody(event))
  // `state` is recorded against a day; `description` edits the recurring item.
  const record = await useRoutineRepository().updateTemplate(user.id, templateId, body)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Routine item not found.' })
  }

  return record
})
