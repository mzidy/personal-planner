import { useShoppingRepository } from '~~/server/utils/shopping-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return useShoppingRepository().getOverview(user.id)
})
