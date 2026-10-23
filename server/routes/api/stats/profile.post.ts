import { statsProfileSchema } from '~~/shared/schemas/stats'
import { useStatsRepository } from '~~/server/utils/stats-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const parsed = statsProfileSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Check the profile values.' })
  }
  const body = parsed.data
  const record = await useStatsRepository().saveProfile(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'update', 'stats-profile', record.id, {
    heightCm: record.heightCm,
    targetWeightKg: record.targetWeightKg
  })
  return record
})
