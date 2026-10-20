import { newXiaomiAgentId } from '~~/server/utils/xiaomi-cloud-protocol'
import { startXiaomiQrLogin } from '~~/server/utils/xiaomi-cloud'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { smartHomeHttpError } from '~~/server/utils/smart-home-vacuum'

/** Step 1 of connecting Xiaomi Home: a QR code to scan in the Xiaomi Home app. No password involved. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'xiaomi-qr', 5, 60_000)
  const repository = useSmartHomeRepository()

  const existing = await repository.findAccountRow(user.id, 'xiaomi')
  const agentId = existing?.clientIdentifier || newXiaomiAgentId()
  try {
    await repository.saveXiaomiPending(user.id, agentId, await startXiaomiQrLogin(agentId))
  } catch (error) {
    throw smartHomeHttpError(error)
  }
  return repository.overview(user.id)
})
