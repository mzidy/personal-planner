import { useGrowthRepository } from '~~/server/utils/growth-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return useGrowthRepository().getOverview(user.id)
})
