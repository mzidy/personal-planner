import { registerSchema } from '~~/shared/schemas/auth'
import { establishSession, toSessionUser } from '~~/server/utils/auth-session'
import { useStatsRepository } from '~~/server/utils/stats-repository'

export default defineEventHandler(async event => {
  await assertRateLimit(event, 'register', 4, 60_000)
  const repository = usePlannerRepository()
  const parsed = registerSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Check the details and try again.' })
  }
  const body = parsed.data
  const config = useRuntimeConfig()
  const existingUsers = await repository.countUsers()
  const passwordHash = await hashPassword(body.password)
  // Gender and date of birth live in the body profile under Personal stats.
  const saveProfile = (userId: string) => useStatsRepository().saveProfile(userId, { gender: body.gender, birthDate: body.birthDate })

  if (config.singleUserMode && existingUsers > 0) {
    if (!config.databaseUrl) {
      const promoted = await repository.promoteDemoUser({
        email: body.email,
        displayName: body.displayName,
        passwordHash
      })

      if (promoted) {
        await saveProfile(promoted.id)
        const verificationToken = await repository.createEmailVerificationToken(promoted.id)
        await repository.createAuditEvent(promoted.id, 'register', 'user', promoted.id, { email: promoted.email })
        await establishSession(event, promoted, 'password')

        return {
          user: toSessionUser(promoted),
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
  await saveProfile(user.id)
  const verificationToken = await repository.createEmailVerificationToken(user.id)
  await repository.createAuditEvent(user.id, 'register', 'user', user.id, { email: user.email })
  await establishSession(event, user, 'password')

  return {
    user: toSessionUser(user),
    verificationSent: true,
    debugToken: !config.databaseUrl ? verificationToken : undefined
  }
})
