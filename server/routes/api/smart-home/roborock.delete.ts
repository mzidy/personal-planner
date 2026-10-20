import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'

/** Forgets the Roborock session and devices here. Nothing changes in the Roborock app. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await useSmartHomeRepository().disconnect(user.id)
  await usePlannerRepository().createAuditEvent(user.id, 'disconnect', 'smart-home-account', null, { provider: 'roborock' })
  return { ok: true }
})
