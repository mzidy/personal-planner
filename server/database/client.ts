import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '~~/server/database/schema'

export type PlannerDatabase = ReturnType<typeof drizzle<typeof schema>>

let client: Client | null = null
let db: PlannerDatabase | null = null

export function databaseFilePath() {
  const config = useRuntimeConfig()
  const file = config.databaseUrl || '.data/planner.db'
  return isAbsolute(file) ? file : resolve(process.cwd(), file)
}

export function useDatabaseClient(): Client {
  if (!client) {
    const path = databaseFilePath()
    mkdirSync(dirname(path), { recursive: true })
    client = createClient({ url: `file:${path}` })
  }

  return client
}

export function useDatabase(): PlannerDatabase {
  if (!db) {
    db = drizzle(useDatabaseClient(), { schema })
  }

  return db
}
