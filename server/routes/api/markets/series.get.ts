import { tickerReviewSchema } from '~~/shared/schemas/ticker'
import { fetchTickerSeries } from '~~/server/utils/ticker-series'

export default defineEventHandler(async event => {
  await requireAppUser(event)

  // Reuses the ticker rule from the analysis page: letters, with . or - allowed.
  const { symbol } = await getValidatedQuery(event, tickerReviewSchema.parse)
  return fetchTickerSeries(symbol)
})
