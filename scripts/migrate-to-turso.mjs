#!/usr/bin/env node
/**
 * Copies one user's data from the local SQLite file into the remote Turso
 * database.
 *
 * Usage:
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     node scripts/migrate-to-turso.mjs [email] [--dry-run] [--skip-audit]
 *
 * The token is read from the environment and never written anywhere. The copy
 * is idempotent: rows are inserted by primary key with INSERT OR IGNORE, so
 * running it twice does not duplicate anything.
 */
import { createClient as createFileClient } from '@libsql/client'
import { createClient as createWebClient } from '@libsql/client/web'

const EMAIL = process.argv.find(arg => arg.includes('@')) || 'mzidy@personal-planner.app'
const DRY_RUN = process.argv.includes('--dry-run')
const SKIP_AUDIT = process.argv.includes('--skip-audit')

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

// A `file:` target is accepted so the whole copy can be rehearsed against a
// throwaway database before it is pointed at production.
const targetIsFile = Boolean(url && url.startsWith('file:'))

if (!url || (!authToken && !targetIsFile)) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running this.')
  process.exit(1)
}

const local = createFileClient({ url: `file:${process.cwd()}/.data/planner.db` })
const remote = targetIsFile ? createFileClient({ url }) : createWebClient({ url, authToken })

async function tableNames(client) {
  const result = await client.execute(
    "select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name"
  )
  return result.rows.map(row => String(row.name))
}

async function columns(client, table) {
  const result = await client.execute(`pragma table_info(${table})`)
  return result.rows.map(row => String(row.name))
}

/** Parent tables this one points at, so rows can be inserted in a valid order. */
async function parents(client, table) {
  const result = await client.execute(`pragma foreign_key_list(${table})`)
  return [...new Set(result.rows.map(row => String(row.table)))].filter(name => name !== table)
}

/** Depth-first topological sort: a table is emitted only after its parents. */
async function sortByDependency(client, tables) {
  const edges = new Map()
  for (const table of tables) {
    edges.set(table, (await parents(client, table)).filter(parent => tables.includes(parent)))
  }

  const ordered = []
  const state = new Map()

  function visit(table) {
    if (state.get(table) === 'done') return
    if (state.get(table) === 'visiting') return // a cycle; order within it does not matter
    state.set(table, 'visiting')
    for (const parent of edges.get(table) || []) {
      visit(parent)
    }
    state.set(table, 'done')
    ordered.push(table)
  }

  for (const table of tables) visit(table)
  return ordered
}

async function main() {
  const [localTables, remoteTables] = await Promise.all([tableNames(local), tableNames(remote)])

  if (!remoteTables.includes('users')) {
    console.error(
      'The remote database has no schema yet. Open the deployed site once so the app creates it, then re-run.'
    )
    process.exit(1)
  }

  const user = await local.execute({
    sql: 'select * from users where email = ?',
    args: [EMAIL]
  })
  const row = user.rows[0]
  if (!row) {
    console.error(`No local user with email ${EMAIL}.`)
    process.exit(1)
  }
  const userId = String(row.id)
  console.log(`User ${EMAIL}\n  local id ${userId}`)

  const existing = await remote.execute({ sql: 'select id from users where email = ?', args: [EMAIL] })
  if (existing.rows.length) {
    console.log('  already present remotely — existing rows will be left alone')
  }

  let tables = localTables.filter(table => remoteTables.includes(table))
  if (SKIP_AUDIT) {
    tables = tables.filter(table => table !== 'audit_events')
  }

  const skipped = localTables.filter(table => !remoteTables.includes(table))
  if (skipped.length) {
    console.log(`  tables missing remotely, not copied: ${skipped.join(', ')}`)
  }

  const ordered = await sortByDependency(local, tables)
  let movedTotal = 0

  for (const table of ordered) {
    const cols = await columns(local, table)
    const scoped = cols.includes('user_id')

    // `users` is matched on its own id; everything else on user_id.
    let select
    if (table === 'users') {
      select = { sql: 'select * from users where id = ?', args: [userId] }
    } else if (scoped) {
      select = { sql: `select * from ${table} where user_id = ?`, args: [userId] }
    } else {
      continue // global table with no link to this user
    }

    const rows = (await local.execute(select)).rows
    if (!rows.length) continue

    if (DRY_RUN) {
      console.log(`  ${table.padEnd(26)} ${rows.length} row(s) would be copied`)
      movedTotal += rows.length
      continue
    }

    const placeholders = cols.map(() => '?').join(', ')
    const statement = `insert or ignore into ${table} (${cols.join(', ')}) values (${placeholders})`

    // Batched so a table of any size stays one round trip per chunk.
    const CHUNK = 50
    for (let index = 0; index < rows.length; index += CHUNK) {
      await remote.batch(
        rows.slice(index, index + CHUNK).map(item => ({
          sql: statement,
          args: cols.map(col => item[col] ?? null)
        })),
        'write'
      )
    }

    console.log(`  ${table.padEnd(26)} ${rows.length} row(s) copied`)
    movedTotal += rows.length
  }

  console.log(`\n${DRY_RUN ? 'Would copy' : 'Copied'} ${movedTotal} row(s).`)

  if (!DRY_RUN) {
    const check = await remote.execute({
      sql: 'select count(*) as c from users where email = ?',
      args: [EMAIL]
    })
    console.log(`Remote now has ${check.rows[0].c} user row for ${EMAIL}.`)
  }
}

main()
  .catch(error => {
    const message = String(error?.message || error)

    // A rejected token comes back as a bare HTTP 400, which says nothing useful.
    if (/HTTP status 40[013]/.test(message)) {
      console.error(
        '\nTurso rejected the connection. The auth token is wrong, expired, or still the placeholder.' +
          '\nCreate one in the Turso dashboard (Create Token, no expiration) and pass the real value.'
      )
      process.exit(1)
    }

    console.error('\nMigration failed:', message)
    process.exit(1)
  })
  .finally(() => {
    local.close?.()
    remote.close?.()
  })
