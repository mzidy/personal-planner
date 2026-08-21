import { statsProfileSchema } from '~~/shared/schemas/stats'
import { useStatsRepository } from '~~/server/utils/stats-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = statsProfileSchema.parse(await readBody(event))
  const record = await useStatsRepository().saveProfile(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'update', 'stats-profile', record.id, {
    heightCm: record.heightCm,
    targetWeightKg: record.targetWeightKg
  })
  return record
})
