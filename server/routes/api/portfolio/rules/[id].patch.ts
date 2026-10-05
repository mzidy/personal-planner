import { portfolioRulePatchSchema } from '~~/shared/schemas/portfolio'
import { usePortfolioRepository } from '~~/server/utils/portfolio-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const ruleId = getRouterParam(event, 'id') || ''
  const body = portfolioRulePatchSchema.parse(await readBody(event))
  const record = await usePortfolioRepository().updateRule(user.id, ruleId, body)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Rule not found.' })
  }

  return record
})
