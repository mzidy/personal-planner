import { objectiveSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = objectiveSchema.parse(await readBody(event))
  const record = await usePlannerRepository().createObjective(user.id, {
    ...body,
    scheduledFor: body.scheduledFor || null,
    dueDate: body.dueDate || null
  })
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'objective', record.id, { title: record.title })
  return record
})
