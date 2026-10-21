import { watchlistOrderSchema } from '~~/shared/schemas/watchlist'
import { useWatchlistRepository } from '~~/server/utils/watchlist-repository'

/** Saves the order after moving a ticker up or down. Quotes are not refetched. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'watchlist-order', 60, 60_000)
  const { ids } = watchlistOrderSchema.parse(await readBody(event))
  await useWatchlistRepository().reorder(user.id, ids)
  return { ok: true }
})
