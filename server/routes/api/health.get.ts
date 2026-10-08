import { databaseFilePath, databaseSettings } from '~~/server/database/client'

export default defineEventHandler(async () => {
  const { url, remote } = databaseSettings()

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    databaseMode: remote ? 'turso' : 'sqlite-file',
    // The host only; the path can carry credentials on some libSQL URLs.
    database: remote ? new URL(url).host : databaseFilePath()
  }
})
