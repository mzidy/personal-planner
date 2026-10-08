import { loginSchema } from '~~/shared/schemas/auth'
import { establishSession } from '~~/server/utils/auth-session'

export default defineEventHandler(async event => {
  await assertRateLimit(event, 'login', 6, 60_000)
  const repository = usePlannerRepository()

  // A bare .parse() throws a raw ZodError, which surfaces to the client as a
  // 500 "Server Error" and tells the user nothing about what was wrong.
  const parsed = loginSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message || 'Enter a valid email and password.'
    })
  }

  const body = parsed.data
  const user = await repository.findUserByEmail(body.email)

  if (!user || !user.passwordHash) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password.' })
  }

  const valid = await verifyPassword(user.passwordHash, body.password)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password.' })
  }

  await repository.createAuditEvent(user.id, 'login', 'session', null, { provider: 'password' })
  await establishSession(event, user, 'password')

  return {
    user
  }
})
