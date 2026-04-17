export default defineEventHandler(async event => {
  const session = await getUserSession(event)

  if (session.user?.id) {
    await usePlannerRepository().createAuditEvent(session.user.id, 'logout', 'session', null)
  }

  await clearUserSession(event)

  return { ok: true }
})
