import { useDatabase } from '~~/server/database/client'
import { seedDemoData, wipeAllData } from '~~/server/utils/db-seed'

/**
 * Wipes every table and reseeds the demo. It needs no session (it is offered on
 * the sign-in page), so it must only ever work on a local SQLite file that
 * still holds nothing but the demo account. Against Turso it would let anyone
 * erase the real workspace with one request.
 */
export default defineEventHandler(async event => {
  await assertRateLimit(event, 'reset-demo', 3, 60_000)
  const config = useRuntimeConfig()

  if (config.databaseUrl) {
    throw createError({ statusCode: 404, statusMessage: 'Not found.' })
  }

  const { demoMode } = await usePlannerRepository().getBootstrap()
  if (!demoMode) {
    throw createError({ statusCode: 403, statusMessage: 'Only a workspace that still holds just the demo account can be reset.' })
  }

  await clearUserSession(event)

  const db = useDatabase()
  await wipeAllData(db)
  await seedDemoData(db)

  return {
    ok: true,
    demoCredentials: {
      email: config.demoUserEmail,
      password: config.demoUserPassword
    }
  }
})
