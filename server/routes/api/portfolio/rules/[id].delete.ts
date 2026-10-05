import { usePortfolioRepository } from '~~/server/utils/portfolio-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const ruleId = getRouterParam(event, 'id') || ''
  const record = await usePortfolioRepository().deleteRule(user.id, ruleId)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Rule not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'portfolio-rule', record.id, {
    name: record.name
  })
  return { ok: true }
})
