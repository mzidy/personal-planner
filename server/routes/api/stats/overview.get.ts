import { useStatsRepository } from '~~/server/utils/stats-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return useStatsRepository().getOverview(user.id)
})
