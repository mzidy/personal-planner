import { useStatsRepository } from '~~/server/utils/stats-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const weighInId = getRouterParam(event, 'id') || ''
  const record = await useStatsRepository().deleteWeighIn(user.id, weighInId)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Weigh-in not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'weigh-in', record.id, { weekKey: record.weekKey })
  return { ok: true }
})
