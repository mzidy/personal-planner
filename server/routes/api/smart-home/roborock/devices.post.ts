import { listRoborockDevices } from '~~/server/utils/roborock-api'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { roborockHttpError } from '~~/server/utils/smart-home-roborock'

/** Reloads the device list, for a vacuum added or renamed in the Roborock app. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  // Roborock rate-limits home data hard (about five times an hour).
  await assertRateLimit(event, 'roborock-devices', 3, 60_000)
  const repository = useSmartHomeRepository()

  const found = await repository.findAccount(user.id)
  const session = found ? repository.session(found.account) : null
  if (!found || !session) {
    throw createError({ statusCode: 401, statusMessage: 'Connect the Roborock account again.' })
  }

  try {
    const devices = await listRoborockDevices(found.region, found.account.email, found.account.clientIdentifier, session)
    await repository.syncDevices(user.id, found.account.id, devices)
  } catch (error) {
    throw roborockHttpError(error)
  }
  return repository.overview(user.id)
})
