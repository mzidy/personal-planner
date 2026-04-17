import { goalAreaSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = goalAreaSchema.parse(await readBody(event))
  const record = await usePlannerRepository().createGoalArea(user.id, {
    ...body,
    dueDate: body.dueDate || null
  })
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'goal_area', record.id, { title: record.title })
  return record
})
