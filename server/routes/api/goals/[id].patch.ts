import { goalAreaUpdateSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const patch = goalAreaUpdateSchema.parse(await readBody(event))
  const record = await usePlannerRepository().updateGoalArea(user.id, getRouterParam(event, 'id') || '', patch)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Goal area not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'update', 'goal_area', record.id, patch)
  return record
})
