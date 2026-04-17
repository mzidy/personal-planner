import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '~~/server/database/schema'

let pool: Pool | null = null
let db: ReturnType<typeof drizzle> | null = null

export function useDatabase() {
  const config = useRuntimeConfig()

  if (!config.databaseUrl) {
    return null
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('localhost') ? undefined : { rejectUnauthorized: false }
    })
  }

  if (!db) {
    db = drizzle(pool, { schema })
  }

  return db
}
