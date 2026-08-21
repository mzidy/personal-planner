import { investmentPositionSchema } from '~~/shared/schemas/investments'
import { useInvestmentsRepository } from '~~/server/utils/investments-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = investmentPositionSchema.parse(await readBody(event))
  const record = await useInvestmentsRepository().createPosition(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'investment-position', record.id, {
    symbol: record.symbol,
    kind: record.kind
  })
  return record
})
