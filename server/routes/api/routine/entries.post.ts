import { routineEntrySchema } from '~~/shared/schemas/routine'
import { useRoutineRepository } from '~~/server/utils/routine-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = routineEntrySchema.parse(await readBody(event))
  const record = await useRoutineRepository().createTemplate(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'routine-item', record.id, {
    description: record.description
  })
  return record
})
