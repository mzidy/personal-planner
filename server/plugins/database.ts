import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { sql } from 'drizzle-orm'
import { useDatabase, useDatabaseClient } from '~~/server/database/client'
import { users } from '~~/server/database/schema'
import { seedDemoData } from '~~/server/utils/db-seed'

export default defineNitroPlugin(async () => {
  const client = useDatabaseClient()
  await client.execute('PRAGMA journal_mode = WAL')
  await client.execute('PRAGMA foreign_keys = ON')

  const db = useDatabase()
  await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') })

  const rows = await db.select({ count: sql<number>`count(*)` }).from(users)
  if (Number(rows[0]?.count ?? 0) === 0) {
    await seedDemoData(db)
    console.info('[database] Seeded demo workspace into SQLite.')
  }
})
