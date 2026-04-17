import { loginSchema } from '~~/shared/schemas/auth'
import { establishSession } from '~~/server/utils/auth-session'

export default defineEventHandler(async event => {
  await assertRateLimit(event, 'login', 6, 60_000)
  const repository = usePlannerRepository()
  const body = loginSchema.parse(await readBody(event))
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
