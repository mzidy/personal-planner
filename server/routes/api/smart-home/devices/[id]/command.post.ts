import { vacuumCommandSchema } from '~~/shared/schemas/smart-home'
import { ROBOROCK_FAN_VALUES } from '~~/shared/utils/roborock-status'
import { type RoborockCall, callRoborock } from '~~/server/utils/roborock-mqtt'
import { resolveRoborockTarget, roborockHttpError } from '~~/server/utils/smart-home-roborock'

/** Only these commands can be sent; there is no pass-through for arbitrary RPC methods. */
const COMMANDS: Record<string, string> = {
  start: 'app_start',
  pause: 'app_pause',
  stop: 'app_stop',
  dock: 'app_charge',
  find: 'find_me'
}

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'vacuum-command', 20, 60_000)
  const body = vacuumCommandSchema.parse(await readBody(event))
  const { device, target } = await resolveRoborockTarget(user.id, getRouterParam(event, 'id') || '')

  let call: RoborockCall
  if (body.action === 'fan') {
    if (body.value === undefined || !ROBOROCK_FAN_VALUES.has(body.value)) {
      throw createError({ statusCode: 400, statusMessage: 'That suction setting is not one this app knows.' })
    }
    call = { method: 'set_custom_mode', params: [body.value] }
  } else {
    call = { method: COMMANDS[body.action]! }
  }

  try {
    await callRoborock(target, [call])
  } catch (error) {
    throw roborockHttpError(error)
  }

  await usePlannerRepository().createAuditEvent(user.id, 'command', 'vacuum', device.id, {
    action: body.action,
    ...(body.value !== undefined ? { value: body.value } : {})
  })
  return { ok: true }
})
