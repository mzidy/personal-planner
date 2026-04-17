import { timeBlockUpdateSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const patch = timeBlockUpdateSchema.parse(await readBody(event))
  const record = await usePlannerRepository().updateTimeBlock(user.id, getRouterParam(event, 'id') || '', patch)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Calendar block not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'update', 'time_block', record.id, patch)
  return record
})
