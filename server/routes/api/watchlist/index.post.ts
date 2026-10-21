import { watchlistAddSchema } from '~~/shared/schemas/watchlist'
import { fetchWatchlistQuote } from '~~/server/utils/watchlist-quotes'
import { useWatchlistRepository } from '~~/server/utils/watchlist-repository'

/** Adds a ticker after checking that Yahoo knows it. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'watchlist-add', 20, 60_000)
  const parsed = watchlistAddSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'That is not a ticker.' })
  }
  const { symbol } = parsed.data

  await fetchWatchlistQuote(symbol)
  const repository = useWatchlistRepository()
  await repository.add(user.id, symbol)
  return repository.view(user.id)
})
