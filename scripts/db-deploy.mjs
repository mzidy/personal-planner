#!/usr/bin/env node
/**
 * Applies the Drizzle migrations in `drizzle/` to the remote Turso database.
 *
 * Usage:
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" node scripts/db-deploy.mjs
 *
 * This has to run from a machine that has the repository, because the migrator
 * reads the SQL files and `meta/_journal.json` from disk — those are not part of
 * a serverless bundle, which is why the app cannot migrate itself on Vercel.
 *
 * Drizzle records applied migrations in `__drizzle_migrations`, so re-running is
 * a no-op.
 */
import { resolve } from 'node:path'
import { createClient } from '@libsql/client/web'
import { drizzle } from 'drizzle-orm/libsql/web'
import { migrate } from 'drizzle-orm/libsql/migrator'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running this.')
  process.exit(1)
}

const client = createClient({ url, authToken })
const db = drizzle(client)

const folder = resolve(process.cwd(), 'drizzle')
console.log(`Applying migrations from ${folder}`)
console.log(`  to ${new URL(url).host}`)

try {
  await migrate(db, { migrationsFolder: folder })

  const tables = await client.execute(
    "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name"
  )
  const names = tables.rows.map(row => String(row.name)).filter(name => !name.startsWith('__drizzle'))

  console.log(`\nDone. ${names.length} tables present:`)
  console.log(`  ${names.join(', ')}`)
} catch (error) {
  const message = String(error?.message || error)

  if (/HTTP status 40[013]/.test(message)) {
    console.error(
      '\nTurso rejected the connection. The auth token is wrong, expired, or still a placeholder.'
    )
    process.exit(1)
  }

  console.error('\nMigration failed:', message)
  process.exit(1)
}
