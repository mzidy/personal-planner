import { tradeInputSchema } from '~~/shared/schemas/trades'
import { readTradeBody, useTradesRepository } from '~~/server/utils/trades-repository'

/** Replaces a trade; closing and reopening it are edits of the exit fields. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'trades-write', 30, 60_000)
  const input = await readTradeBody(event, tradeInputSchema)
  const repository = useTradesRepository()
  await repository.updateTrade(user.id, getRouterParam(event, 'id') || '', input)
  return repository.view(user.id)
})
