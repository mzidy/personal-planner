export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const repository = usePlannerRepository()
  const record = await repository.deleteObjective(user.id, getRouterParam(event, 'id') || '')

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Priority not found.' })
  }

  await repository.createAuditEvent(user.id, 'delete', 'objective', record.id, {
    title: record.title
  })
  return { ok: true }
})
