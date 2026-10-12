import { objectiveSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)

  // A bare .parse() throws a raw ZodError, which reaches the client as a 500
  // "Server Error" naming neither the field nor the rule it broke.
  const parsed = objectiveSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw createError({
      statusCode: 400,
      statusMessage: issue
        ? `${issue.path.join('.') || 'request'}: ${issue.message}`
        : 'That objective is not valid.'
    })
  }

  const body = parsed.data
  const record = await usePlannerRepository().createObjective(user.id, {
    ...body,
    scheduledFor: body.scheduledFor || null,
    dueDate: body.dueDate || null
  })
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'objective', record.id, { title: record.title })
  return record
})
