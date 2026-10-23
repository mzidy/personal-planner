import { useTradesRepository } from '~~/server/utils/trades-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'trades', 30, 60_000)
  return useTradesRepository().view(user.id)
})
