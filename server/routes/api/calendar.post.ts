import { timeBlockSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = timeBlockSchema.parse(await readBody(event))
  const record = await usePlannerRepository().createTimeBlock(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'time_block', record.id, { title: record.title })
  return record
})
