import { objectiveUpdateSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const patch = objectiveUpdateSchema.parse(await readBody(event))
  const record = await usePlannerRepository().updateObjective(user.id, getRouterParam(event, 'id') || '', patch)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Priority not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'update', 'objective', record.id, patch)
  return record
})
