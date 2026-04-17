import { resetPasswordSchema } from '~~/shared/schemas/auth'

export default defineEventHandler(async event => {
  await assertRateLimit(event, 'reset-password', 5, 60_000)
  const repository = usePlannerRepository()
  const body = resetPasswordSchema.parse(await readBody(event))
  const token = await repository.consumePasswordResetToken(body.token)

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'This reset link is invalid or expired.' })
  }

  const user = await repository.updateUserPassword(token.userId, await hashPassword(body.password))

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found.' })
  }

  await repository.createAuditEvent(user.id, 'reset-password', 'user', user.id)

  return {
    ok: true
  }
})
