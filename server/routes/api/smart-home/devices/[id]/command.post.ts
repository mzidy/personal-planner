import { vacuumCommandSchema } from '~~/shared/schemas/smart-home'
import { ROBOROCK_FAN_VALUES } from '~~/shared/utils/roborock-status'
import type { RoborockCall } from '~~/server/utils/roborock-mqtt'
import { resolveVacuum, smartHomeHttpError } from '~~/server/utils/smart-home-vacuum'

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
  const vacuum = await resolveVacuum(user.id, getRouterParam(event, 'id') || '')

  let call: RoborockCall
  if (body.action === 'fan') {
    if (body.value === undefined || !ROBOROCK_FAN_VALUES.has(body.value)) {
      throw createError({ statusCode: 400, statusMessage: 'That suction setting is not one this app knows.' })
    }
    call = { method: 'set_custom_mode', params: [body.value] }
  } else {
    call = { method: COMMANDS[body.action]! }
  }

  let result: PromiseSettledResult<unknown> | undefined
  try {
    ;[result] = await vacuum.run([call])
  } catch (error) {
    throw smartHomeHttpError(error)
  }
  if (result?.status !== 'fulfilled') {
    throw smartHomeHttpError(result?.reason)
  }

  await usePlannerRepository().createAuditEvent(user.id, 'command', 'vacuum', vacuum.device.id, {
    provider: vacuum.provider,
    action: body.action,
    ...(body.value !== undefined ? { value: body.value } : {})
  })
  return { ok: true }
})
