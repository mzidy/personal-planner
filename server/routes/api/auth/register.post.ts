import { registerSchema } from '~~/shared/schemas/auth'
import { establishSession } from '~~/server/utils/auth-session'

export default defineEventHandler(async event => {
  await assertRateLimit(event, 'register', 4, 60_000)
  const repository = usePlannerRepository()
  const body = registerSchema.parse(await readBody(event))
  const config = useRuntimeConfig()
  const existingUsers = await repository.countUsers()
  const passwordHash = await hashPassword(body.password)

  if (config.singleUserMode && existingUsers > 0) {
    if (!config.databaseUrl) {
      const promoted = await repository.promoteDemoUser({
        email: body.email,
        displayName: body.displayName,
        passwordHash
      })

      if (promoted) {
        const verificationToken = await repository.createEmailVerificationToken(promoted.id)
        await repository.createAuditEvent(promoted.id, 'register', 'user', promoted.id, { email: promoted.email })
        await establishSession(event, promoted, 'password')

        return {
          user: promoted,
          verificationSent: true,
          debugToken: verificationToken
        }
      }
    }

    throw createError({
      statusCode: 409,
      statusMessage: 'This workspace is already initialized for a single account.'
    })
  }

  const existingUser = await repository.findUserByEmail(body.email)
  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists.' })
  }

  const user = await repository.createUser({
    email: body.email,
    displayName: body.displayName,
    passwordHash,
    emailVerified: false
  })
  const verificationToken = await repository.createEmailVerificationToken(user.id)
  await repository.createAuditEvent(user.id, 'register', 'user', user.id, { email: user.email })
  await establishSession(event, user, 'password')

  return {
    user,
    verificationSent: true,
    debugToken: !config.databaseUrl ? verificationToken : undefined
  }
})
