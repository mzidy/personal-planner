import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import type { Client } from '@libsql/client'
import { createClient as createWebClient } from '@libsql/client/web'
import { drizzle as drizzleWeb } from 'drizzle-orm/libsql/web'
import * as schema from '~~/server/database/schema'

export type PlannerDatabase = ReturnType<typeof drizzleWeb<typeof schema>>

let client: Client | null = null
let db: PlannerDatabase | null = null

/**
 * The same code talks to a local SQLite file in development and to Turso
 * (hosted libSQL) in production; which one is used is decided purely by env.
 *
 * Serverless hosts give each instance a read-only, ephemeral filesystem, so a
 * file-backed database on Vercel would lose every write. Remote is the only
 * workable option there — and it must use the fetch-based `@libsql/client/web`
 * build, since the default client carries native bindings.
 */
export function databaseSettings() {
  const config = useRuntimeConfig()
  const url = (config.tursoDatabaseUrl as string) || process.env.TURSO_DATABASE_URL || ''
  const authToken = (config.tursoAuthToken as string) || process.env.TURSO_AUTH_TOKEN || ''

  return { url, authToken, remote: Boolean(url) }
}

export function isRemoteDatabase() {
  return databaseSettings().remote
}

export function databaseFilePath() {
  const config = useRuntimeConfig()
  const file = config.databaseUrl || '.data/planner.db'
  return isAbsolute(file) ? file : resolve(process.cwd(), file)
}

export function useDatabaseClient(): Client {
  if (client) {
    return client
  }

  const { url, authToken, remote } = databaseSettings()

  if (remote) {
    // Turso rejects unauthenticated connections, and its own error is far less
    // obvious than saying which variable is missing.
    if (!authToken && !url.startsWith('http://')) {
      throw new Error(
        'TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing. Create one with `turso db tokens create <db>`.'
      )
    }

    client = createWebClient({ url, authToken: authToken || undefined })
    return client
  }

  // A serverless filesystem is read-only, so falling back to a file here would
  // fail with a bare EROFS from mkdirSync. Say what is actually missing.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error(
      'No database configured. This deployment needs TURSO_DATABASE_URL and TURSO_AUTH_TOKEN — a local SQLite file cannot be used on a serverless host.'
    )
  }

  /*
   * Required lazily and only for the local-file path. The default
   * `@libsql/client` entry pulls in the native `libsql` bindings, which have no
   * business being in a serverless bundle — a static import would drag them in
   * even on deployments that only ever talk to Turso.
   */
  const path = databaseFilePath()
  mkdirSync(dirname(path), { recursive: true })

  const require = createRequire(import.meta.url)
  const { createClient: createFileClient } = require('@libsql/client') as typeof import('@libsql/client')

  client = createFileClient({ url: `file:${path}` })
  return client
}

export function useDatabase(): PlannerDatabase {
  if (db) {
    return db
  }

  const client = useDatabaseClient()

  /*
   * `drizzle-orm/libsql` (the node driver) imports `@libsql/client`, which
   * requires the native `libsql` bindings — that static import alone is enough
   * to break a serverless deploy with "Cannot find module
   * '@libsql/linux-x64-gnu'", even when every query goes to Turso. The web
   * driver has no such dependency, so it is the one imported statically and the
   * node driver is pulled in only when actually opening a local file.
   */
  if (isRemoteDatabase()) {
    db = drizzleWeb(client, { schema })
    return db
  }

  const require = createRequire(import.meta.url)
  const { drizzle } = require('drizzle-orm/libsql') as typeof import('drizzle-orm/libsql')
  db = drizzle(client, { schema }) as unknown as PlannerDatabase

  return db
}
