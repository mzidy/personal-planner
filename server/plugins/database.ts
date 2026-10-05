import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { sql } from 'drizzle-orm'
import { isRemoteDatabase, useDatabase, useDatabaseClient } from '~~/server/database/client'
import { users } from '~~/server/database/schema'
import { seedDemoData } from '~~/server/utils/db-seed'

export default defineNitroPlugin(async () => {
  const client = useDatabaseClient()
  const remote = isRemoteDatabase()

  // WAL is a local-file concern; a remote libSQL server manages its own journal.
  if (!remote) {
    await client.execute('PRAGMA journal_mode = WAL')
  }
  await client.execute('PRAGMA foreign_keys = ON')

  const db = useDatabase()

  /*
   * Migrations are applied from a developer machine, not at boot, whenever the
   * database is remote. Drizzle's migrator reads the `drizzle/` folder from
   * disk, and that folder is not part of a serverless bundle — calling it here
   * fails with "Can't find meta/_journal.json file" and leaves the database
   * with no tables at all. Use `npm run db:deploy` instead.
   */
  if (!remote) {
    await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') })
  }

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .catch(() => {
      if (remote) {
        throw new Error(
          'The remote database has no schema. Apply migrations with `npm run db:deploy` (needs TURSO_DATABASE_URL and TURSO_AUTH_TOKEN).'
        )
      }
      throw new Error('Could not read the users table.')
    })

  if (Number(rows[0]?.count ?? 0) === 0) {
    if (remote) {
      // A shared production database should not quietly gain a demo account with
      // a published password; the owner account is created deliberately instead.
      console.warn('[database] No users yet. Visit /register to claim the workspace.')
      return
    }
    await seedDemoData(db)
    console.info('[database] Seeded demo workspace into SQLite.')
  }
})
