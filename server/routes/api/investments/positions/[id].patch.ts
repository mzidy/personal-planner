import { investmentPositionPatchSchema } from '~~/shared/schemas/investments'
import { useInvestmentsRepository } from '~~/server/utils/investments-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const positionId = getRouterParam(event, 'id') || ''
  const body = investmentPositionPatchSchema.parse(await readBody(event))
  const record = await useInvestmentsRepository().updatePosition(user.id, positionId, body)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Position not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'update', 'investment-position', record.id, {
    symbol: record.symbol
  })
  return record
})
