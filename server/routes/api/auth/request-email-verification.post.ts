export default defineEventHandler(async event => {
  await assertRateLimit(event, 'request-email-verification', 4, 60_000)
  const user = await requireAppUser(event)
  const repository = usePlannerRepository()
  const config = useRuntimeConfig()
  const token = await repository.createEmailVerificationToken(user.id)
  await repository.createAuditEvent(user.id, 'request-email-verification', 'user', user.id)

  return {
    sent: true,
    debugToken: !config.databaseUrl ? token : undefined
  }
})
