import { usePortfolioRepository } from '~~/server/utils/portfolio-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return usePortfolioRepository().getOverview(user.id)
})
