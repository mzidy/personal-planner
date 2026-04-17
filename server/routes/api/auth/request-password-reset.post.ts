import { requestPasswordResetSchema } from '~~/shared/schemas/auth'

export default defineEventHandler(async event => {
  await assertRateLimit(event, 'request-password-reset', 4, 60_000)
  const repository = usePlannerRepository()
  const body = requestPasswordResetSchema.parse(await readBody(event))
  const user = await repository.findUserByEmail(body.email)
  const config = useRuntimeConfig()

  if (!user) {
    return {
      sent: true
    }
  }

  const token = await repository.createPasswordResetToken(user.id)
  await repository.createAuditEvent(user.id, 'request-password-reset', 'user', user.id)

  return {
    sent: true,
    debugToken: !config.databaseUrl ? token : undefined
  }
})
