import { tradeInputSchema } from '~~/shared/schemas/trades'
import { readTradeBody, useTradesRepository } from '~~/server/utils/trades-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'trades-write', 30, 60_000)
  const input = await readTradeBody(event, tradeInputSchema)
  const repository = useTradesRepository()
  await repository.addTrade(user.id, input)
  return repository.view(user.id)
})
