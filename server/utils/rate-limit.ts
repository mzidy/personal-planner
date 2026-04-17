import type { H3Event } from 'h3'

const DEFAULT_LIMIT = 10
const DEFAULT_WINDOW_MS = 60_000

export async function assertRateLimit(event: H3Event, bucket: string, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const storage = useStorage('cache')
  const key = `rate:${bucket}:${ip}`
  const now = Date.now()
  const current = (await storage.getItem<{ count: number; resetAt: number }>(key)) || {
    count: 0,
    resetAt: now + windowMs
  }

  if (current.resetAt < now) {
    current.count = 0
    current.resetAt = now + windowMs
  }

  current.count += 1
  await storage.setItem(key, current)

  if (current.count > limit) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts. Please wait before trying again.'
    })
  }
}
