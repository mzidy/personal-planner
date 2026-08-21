import { useInvestmentsRepository } from '~~/server/utils/investments-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const positionId = getRouterParam(event, 'id') || ''
  const record = await useInvestmentsRepository().deletePosition(user.id, positionId)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Position not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'investment-position', record.id, {
    symbol: record.symbol
  })
  return { ok: true }
})
