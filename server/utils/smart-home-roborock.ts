import { RoborockApiError } from '~~/server/utils/roborock-api'
import { RoborockDeviceError, type RoborockTarget } from '~~/server/utils/roborock-mqtt'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'

/** The device, and what is needed to reach it, or an HTTP error that says what is missing. */
export async function resolveRoborockTarget(userId: string, deviceId: string) {
  const repository = useSmartHomeRepository()
  const device = await repository.findDevice(userId, deviceId)
  if (!device) {
    throw createError({ statusCode: 404, statusMessage: 'Device not found.' })
  }
  if (device.protocolVersion !== '1.0') {
    throw createError({
      statusCode: 409,
      statusMessage: `This device speaks Roborock protocol ${device.protocolVersion}, which is not supported here yet.`
    })
  }

  const found = await repository.findAccount(userId)
  const session = found ? repository.session(found.account) : null
  const localKey = repository.deviceKey(device)
  if (!session || !localKey) {
    throw createError({ statusCode: 401, statusMessage: 'Connect the Roborock account again.' })
  }

  const target: RoborockTarget = { duid: device.duid, localKey, rriot: session.rriot }
  return { device, target }
}

/** Roborock failures as HTTP errors the page can show as they are. */
export function roborockHttpError(error: unknown) {
  if (error instanceof RoborockApiError) {
    return createError({ statusCode: error.sessionExpired ? 401 : 400, statusMessage: error.message })
  }
  if (error instanceof RoborockDeviceError) {
    return createError({ statusCode: error.refused ? 409 : 504, statusMessage: error.message })
  }
  return error
}
