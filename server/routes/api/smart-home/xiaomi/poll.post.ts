import { xiaomiApiBase } from '~~/server/utils/xiaomi-cloud-protocol'
import { findXiaomiVacuums, pollXiaomiQrLogin } from '~~/server/utils/xiaomi-cloud'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { xiaomiDeviceInputs } from '~~/server/utils/smart-home-xiaomi'
import { smartHomeHttpError } from '~~/server/utils/smart-home-vacuum'

/**
 * Step 2: waits up to about 20 seconds for the code to be scanned and
 * confirmed in the app. The page asks again until it is, or the code expires.
 */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'xiaomi-poll', 20, 60_000)
  const repository = useSmartHomeRepository()

  const account = await repository.findAccountRow(user.id, 'xiaomi')
  const pending = account ? repository.xiaomiState(account).pending : undefined
  if (!account || !pending) {
    return { scanned: false, ...(await repository.overview(user.id)) }
  }
  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    await repository.clearXiaomiPending(account)
    throw createError({ statusCode: 410, statusMessage: 'The QR code expired. Show a new one.' })
  }

  try {
    const session = await pollXiaomiQrLogin(pending.pollUrl, account.clientIdentifier)
    if (!session) {
      return { scanned: false, ...(await repository.overview(user.id)) }
    }
    const { server, devices } = await findXiaomiVacuums(session)
    await repository.saveXiaomiSession(account.id, session, server, xiaomiApiBase(server))
    await repository.syncDevices(user.id, account.id, xiaomiDeviceInputs(devices))
  } catch (error) {
    throw smartHomeHttpError(error)
  }

  await usePlannerRepository().createAuditEvent(user.id, 'connect', 'smart-home-account', account.id, { provider: 'xiaomi' })
  return { scanned: true, ...(await repository.overview(user.id)) }
})
