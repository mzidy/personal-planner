import { findXiaomiVacuums } from '~~/server/utils/xiaomi-cloud'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { xiaomiDeviceInputs } from '~~/server/utils/smart-home-xiaomi'
import { smartHomeHttpError } from '~~/server/utils/smart-home-vacuum'

/** Reloads the vacuums on the Xiaomi account, for one added or renamed in Xiaomi Home. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'xiaomi-devices', 3, 60_000)
  const repository = useSmartHomeRepository()

  const account = await repository.findAccountRow(user.id, 'xiaomi')
  const session = account ? repository.xiaomiState(account).session : undefined
  if (!account || !session) {
    throw createError({ statusCode: 401, statusMessage: 'Connect the Xiaomi account again.' })
  }

  try {
    const { devices } = await findXiaomiVacuums(session)
    await repository.syncDevices(user.id, account.id, xiaomiDeviceInputs(devices))
  } catch (error) {
    throw smartHomeHttpError(error)
  }
  return repository.overview(user.id)
})
