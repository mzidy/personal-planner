import { closeOnDateQuerySchema } from '~~/shared/schemas/trades'
import { fetchCloseOnDate } from '~~/server/utils/watchlist-quotes'

/** A stock's close on a given day, to fill in a price the user left empty. */
export default defineEventHandler(async event => {
  await requireAppUser(event)
  await assertRateLimit(event, 'trades-close', 60, 60_000)
  const parsed = closeOnDateQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Give a ticker and a date.' })
  }
  return fetchCloseOnDate(parsed.data.symbol, parsed.data.date)
})
