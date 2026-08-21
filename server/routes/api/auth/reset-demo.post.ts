import { useDatabase } from '~~/server/database/client'
import { seedDemoData, wipeAllData } from '~~/server/utils/db-seed'

export default defineEventHandler(async event => {
  await assertRateLimit(event, 'reset-demo', 3, 60_000)
  const config = useRuntimeConfig()

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
