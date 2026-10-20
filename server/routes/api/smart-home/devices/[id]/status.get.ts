import { readRoborockConsumables, readRoborockStatus, readRoborockSummary } from '~~/shared/utils/roborock-status'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { isUnreachable, resolveVacuum, smartHomeHttpError } from '~~/server/utils/smart-home-vacuum'

/**
 * Asks the vacuum for its status, through whichever cloud it lives in. With
 * ?details=1 it also asks for consumable wear and the lifetime summary.
 */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'vacuum-status', 30, 60_000)
  const details = getQuery(event).details === '1'
  const vacuum = await resolveVacuum(user.id, getRouterParam(event, 'id') || '')
  const repository = useSmartHomeRepository()

  let results: PromiseSettledResult<unknown>[]
  try {
    results = await vacuum.run([
      { method: 'get_status' },
      ...(details ? [{ method: 'get_consumable' }, { method: 'get_clean_summary' }] : [])
    ])
  } catch (error) {
    throw smartHomeHttpError(error)
  }

  const [status, consumables, summary] = results
  if (status?.status !== 'fulfilled') {
    const reason = status?.reason
    if (isUnreachable(reason)) {
      await repository.saveStatus(vacuum.device.id, null, false)
    }
    throw smartHomeHttpError(reason)
  }

  const read = readRoborockStatus(status.value, new Date().toISOString())
  await repository.saveStatus(vacuum.device.id, read, read.state !== 101)

  return {
    status: read,
    consumables: consumables?.status === 'fulfilled' ? readRoborockConsumables(consumables.value) : null,
    summary: summary?.status === 'fulfilled' ? readRoborockSummary(summary.value) : null
  }
})
