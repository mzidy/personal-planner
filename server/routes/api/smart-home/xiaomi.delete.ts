import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'

/** Forgets the Xiaomi session and vacuums here. Nothing changes in the Xiaomi Home app. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await useSmartHomeRepository().disconnect(user.id, 'xiaomi')
  await usePlannerRepository().createAuditEvent(user.id, 'disconnect', 'smart-home-account', null, { provider: 'xiaomi' })
  return { ok: true }
})
