import { databaseFilePath } from '~~/server/database/client'

export default defineEventHandler(async () => {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    databaseMode: 'sqlite',
    databaseFile: databaseFilePath()
  }
})
