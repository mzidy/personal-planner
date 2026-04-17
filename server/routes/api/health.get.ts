export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    databaseMode: config.databaseUrl ? 'postgresql' : 'demo-storage'
  }
})
