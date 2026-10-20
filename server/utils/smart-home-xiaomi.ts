import type { DeviceInput } from '~~/server/utils/smart-home-repository'
import type { XiaomiDeviceInfo } from '~~/server/utils/xiaomi-cloud'

/** Roborock-made vacuums in Xiaomi Home take the same miio commands as in the Roborock app. */
const ROBOROCK_MADE = /^(roborock|rockrobo)\.vacuum\./

export function xiaomiDeviceInputs(devices: XiaomiDeviceInfo[]): DeviceInput[] {
  return devices.map(device => ({
    duid: device.did,
    name: device.name,
    model: device.model,
    productName: 'Xiaomi Home',
    protocolVersion: ROBOROCK_MADE.test(device.model) ? 'miio' : 'miot',
    localKey: null,
    online: device.online
  }))
}
