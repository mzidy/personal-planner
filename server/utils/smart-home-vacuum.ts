import type { SmartHomeProvider } from '~~/shared/types/smart-home'
import { RoborockApiError } from '~~/server/utils/roborock-api'
import { RoborockDeviceError, type RoborockCall, callRoborockSettled } from '~~/server/utils/roborock-mqtt'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { XiaomiCloudError, callXiaomiDevice, fetchXiaomiVacuumMap } from '~~/server/utils/xiaomi-cloud'

/**
 * One way to talk to a vacuum, whichever app it lives in. Both paths carry
 * the same miio commands (get_status, app_start, ...): Roborock's over its
 * MQTT broker, Xiaomi's through its cloud's /home/rpc relay.
 */
export interface VacuumLink {
  device: { id: string; name: string }
  provider: SmartHomeProvider
  /** Every call's own outcome; only failing to reach the cloud at all throws. */
  run: (calls: RoborockCall[]) => Promise<PromiseSettledResult<unknown>[]>
  /** The raw RRMap bytes, where this connection can fetch them (Xiaomi Home for now). */
  fetchMap: (() => Promise<Buffer>) | null
}

function reconnect(provider: SmartHomeProvider) {
  return createError({
    statusCode: 401,
    statusMessage: provider === 'xiaomi' ? 'Connect the Xiaomi account again.' : 'Connect the Roborock account again.'
  })
}

export async function resolveVacuum(userId: string, deviceId: string): Promise<VacuumLink> {
  const repository = useSmartHomeRepository()
  const found = await repository.findDevice(userId, deviceId)
  if (!found) {
    throw createError({ statusCode: 404, statusMessage: 'Device not found.' })
  }
  const { device, account } = found
  const provider = account.provider as SmartHomeProvider

  if (provider === 'xiaomi') {
    if (device.protocolVersion !== 'miio') {
      throw createError({ statusCode: 409, statusMessage: `${device.model} is not a Roborock-made vacuum, so these commands do not apply to it yet.` })
    }
    const session = repository.xiaomiState(account).session
    if (!session) {
      throw reconnect(provider)
    }
    return {
      device,
      provider,
      run: calls =>
        Promise.allSettled(
          calls.map(call =>
            callXiaomiDevice(session, account.country, device.duid, call.method, Array.isArray(call.params) ? call.params : [])
          )
        ),
      fetchMap: () => fetchXiaomiVacuumMap(session, account.country, device.duid)
    }
  }

  if (device.protocolVersion !== '1.0') {
    throw createError({
      statusCode: 409,
      statusMessage: `This device speaks Roborock protocol ${device.protocolVersion}, which is not supported here yet.`
    })
  }
  const session = repository.session(account)
  const localKey = repository.deviceKey(device)
  if (!session || !localKey) {
    throw reconnect(provider)
  }
  return {
    device,
    provider,
    run: calls => callRoborockSettled({ duid: device.duid, localKey, rriot: session.rriot }, calls),
    // Over Roborock's MQTT the map arrives as a separate encrypted frame; not wired up yet.
    fetchMap: null
  }
}

/** Provider failures as HTTP errors the page can show as they are. */
export function smartHomeHttpError(error: unknown) {
  if (error instanceof RoborockApiError) {
    return createError({ statusCode: error.sessionExpired ? 401 : 400, statusMessage: error.message })
  }
  if (error instanceof RoborockDeviceError || error instanceof XiaomiCloudError) {
    const expired = error instanceof XiaomiCloudError && error.sessionExpired
    return createError({ statusCode: expired ? 401 : error.refused ? 409 : 504, statusMessage: error.message })
  }
  return error
}

/** True when the device itself could not be reached, as opposed to refusing or a login problem. */
export function isUnreachable(error: unknown) {
  return (
    (error instanceof RoborockDeviceError && !error.refused) ||
    (error instanceof XiaomiCloudError && !error.refused && !error.sessionExpired)
  )
}
