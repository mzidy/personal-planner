import type { VacuumStatus } from '~~/shared/types/smart-home'
import { readRoborockStatus } from '~~/shared/utils/roborock-status'
import type { RoborockCall } from '~~/server/utils/roborock-mqtt'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { isUnreachable, resolveVacuum } from '~~/server/utils/smart-home-vacuum'

/** What Alexa can ask of the vacuum: the same fixed commands as the Smart Home page. */
export type VacuumAction = 'start' | 'pause' | 'dock' | 'find' | 'status'

const CALLS: Record<Exclude<VacuumAction, 'status'>, RoborockCall> = {
  start: { method: 'app_start' },
  pause: { method: 'app_pause' },
  dock: { method: 'app_charge' },
  find: { method: 'find_me' }
}

const DONE: Record<Exclude<VacuumAction, 'status'>, string> = {
  start: 'Starting the vacuum.',
  pause: 'Pausing the vacuum.',
  dock: 'Sending the vacuum back to its dock.',
  find: 'The vacuum is saying where it is.'
}

/** "The vacuum is charging, battery 87 percent." — or the problem, when it reports one. */
export function vacuumStatusSpeech(status: VacuumStatus) {
  const battery = status.battery !== null ? `, battery ${status.battery} percent` : ''
  if (status.errorCode) {
    return `The vacuum has a problem: ${status.errorLabel}${battery}.`
  }
  return `The vacuum is ${status.stateLabel.toLowerCase()}${battery}.`
}

/**
 * Carries out a vacuum command for a linked user, on the first vacuum the
 * Smart Home page can control, and says how it went.
 */
export async function runVacuumAction(userId: string, action: VacuumAction) {
  const device = (await useSmartHomeRepository().overview(userId)).devices.find(entry => entry.supported)
  if (!device) {
    return 'There is no vacuum connected in Serene. Connect one under Smart Home first.'
  }

  let vacuum: Awaited<ReturnType<typeof resolveVacuum>>
  try {
    vacuum = await resolveVacuum(userId, device.id)
  } catch (error) {
    return `I can't reach the vacuum: ${(error as { statusMessage?: string }).statusMessage || 'the connection needs attention'}.`
  }

  const [result] = await vacuum.run([action === 'status' ? { method: 'get_status' } : CALLS[action]]).catch(error => [
    { status: 'rejected', reason: error } as PromiseRejectedResult
  ])
  if (result?.status !== 'fulfilled') {
    const reason = result?.reason as { message?: string } | undefined
    return isUnreachable(reason) ? 'The vacuum is not answering. It may be offline.' : `The vacuum said no: ${reason?.message || 'it refused'}.`
  }

  if (action === 'status') {
    const status = readRoborockStatus(result.value, new Date().toISOString())
    await useSmartHomeRepository().saveStatus(vacuum.device.id, status, status.state !== 101)
    return vacuumStatusSpeech(status)
  }

  await usePlannerRepository().createAuditEvent(userId, 'command', 'vacuum', vacuum.device.id, {
    provider: vacuum.provider,
    action,
    via: 'alexa'
  })
  return DONE[action]
}
