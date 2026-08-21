import { useInvestmentsRepository } from '~~/server/utils/investments-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return useInvestmentsRepository().getOverview(user.id)
})
