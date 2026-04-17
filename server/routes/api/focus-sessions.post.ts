import { focusSessionSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = focusSessionSchema.parse(await readBody(event))
  const record = await usePlannerRepository().createFocusSession(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'focus_session', record.id, { title: record.title })
  return record
})
