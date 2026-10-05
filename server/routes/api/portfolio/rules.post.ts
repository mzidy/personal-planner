import { portfolioRuleSchema } from '~~/shared/schemas/portfolio'
import { usePortfolioRepository } from '~~/server/utils/portfolio-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = portfolioRuleSchema.parse(await readBody(event))
  const record = await usePortfolioRepository().createRule(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'portfolio-rule', record.id, {
    name: record.name
  })
  return record
})
