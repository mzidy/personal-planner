import { useWatchlistRepository } from '~~/server/utils/watchlist-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const repository = useWatchlistRepository()
  await repository.remove(user.id, getRouterParam(event, 'id') || '')
  return repository.view(user.id)
})
