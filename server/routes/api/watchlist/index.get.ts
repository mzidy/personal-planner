import { useWatchlistRepository } from '~~/server/utils/watchlist-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'watchlist', 30, 60_000)
  return useWatchlistRepository().view(user.id)
})
