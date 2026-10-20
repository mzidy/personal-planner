import { readRoborockConsumables, readRoborockStatus, readRoborockSummary } from '~~/shared/utils/roborock-status'
import { RoborockDeviceError, callRoborockSettled } from '~~/server/utils/roborock-mqtt'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { resolveRoborockTarget, roborockHttpError } from '~~/server/utils/smart-home-roborock'

/**
 * Asks the vacuum for its status over Roborock's cloud. With ?details=1 it
 * also asks for consumable wear and the lifetime cleaning summary.
 */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'vacuum-status', 30, 60_000)
  const details = getQuery(event).details === '1'
  const { device, target } = await resolveRoborockTarget(user.id, getRouterParam(event, 'id') || '')
  const repository = useSmartHomeRepository()

  let results: PromiseSettledResult<unknown>[]
  try {
    results = await callRoborockSettled(target, [
      { method: 'get_status' },
      ...(details ? [{ method: 'get_consumable' }, { method: 'get_clean_summary' }] : [])
    ])
  } catch (error) {
    throw roborockHttpError(error)
  }

  const [status, consumables, summary] = results
  if (status?.status !== 'fulfilled') {
    const reason = status?.reason
    if (reason instanceof RoborockDeviceError && !reason.refused) {
      await repository.saveStatus(device.id, null, false)
    }
    throw roborockHttpError(reason)
  }

  const read = readRoborockStatus(status.value, new Date().toISOString())
  await repository.saveStatus(device.id, read, read.state !== 101)

  return {
    status: read,
    consumables: consumables?.status === 'fulfilled' ? readRoborockConsumables(consumables.value) : null,
    summary: summary?.status === 'fulfilled' ? readRoborockSummary(summary.value) : null
  }
})
