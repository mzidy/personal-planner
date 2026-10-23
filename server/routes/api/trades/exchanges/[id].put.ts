import { exchangeInputSchema } from '~~/shared/schemas/trades'
import { readTradeBody, useTradesRepository } from '~~/server/utils/trades-repository'

/** Replaces an exchange; closing and reopening it are edits of the closing fields. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'trades-write', 30, 60_000)
  const input = await readTradeBody(event, exchangeInputSchema)
  const repository = useTradesRepository()
  await repository.updateExchange(user.id, getRouterParam(event, 'id') || '', input)
  return repository.view(user.id)
})
