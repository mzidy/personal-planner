import { verifyEmailSchema } from '~~/shared/schemas/auth'

export default defineEventHandler(async event => {
  await assertRateLimit(event, 'verify-email', 5, 60_000)
  const repository = usePlannerRepository()
  const body = verifyEmailSchema.parse(await readBody(event))
  const token = await repository.consumeEmailVerificationToken(body.token)

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'This verification link is invalid or expired.' })
  }

  const user = await repository.markEmailVerified(token.userId)

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found.' })
  }

  await repository.createAuditEvent(user.id, 'verify-email', 'user', user.id)

  return {
    ok: true
  }
})
