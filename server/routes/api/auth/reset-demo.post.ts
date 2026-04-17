import { resetPlannerState } from '~~/server/utils/planner-store'

export default defineEventHandler(async event => {
  await assertRateLimit(event, 'reset-demo', 3, 60_000)
  const config = useRuntimeConfig()

  if (config.databaseUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Demo reset is only available in local demo mode.'
    })
  }

  await clearUserSession(event)
  await resetPlannerState()

  return {
    ok: true,
    demoCredentials: {
      email: config.demoUserEmail,
      password: config.demoUserPassword
    }
  }
})
