import { weighInSchema } from '~~/shared/schemas/stats'
import { useStatsRepository } from '~~/server/utils/stats-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = weighInSchema.parse(await readBody(event))
  const record = await useStatsRepository().saveWeighIn(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'weigh-in', record.id, {
    weekKey: record.weekKey,
    weightKg: record.weightKg
  })
  return record
})
