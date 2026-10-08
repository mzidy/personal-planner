import { tickerReviewSchema } from '~~/shared/schemas/ticker'
import { useTickerRepository } from '~~/server/utils/ticker-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = await readValidatedBody(event, tickerReviewSchema.parse)
  const record = await useTickerRepository().createReview(user.id, body.symbol)

  await usePlannerRepository().createAuditEvent(user.id, 'create', 'ticker-review', record.id, {
    symbol: record.symbol
  })
  return record
})
