import { useTradesRepository } from '~~/server/utils/trades-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const repository = useTradesRepository()
  await repository.removeExchange(user.id, getRouterParam(event, 'id') || '')
  return repository.view(user.id)
})
