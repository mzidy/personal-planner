import type { VacuumConsumables, VacuumFanOption, VacuumStatus, VacuumSummary } from '../types/smart-home'

/**
 * Reading a V1 Roborock vacuum's raw answers. Codes and lifetimes come from
 * python-roborock (roborock/data/v1/v1_code_mappings.py and const.py).
 */

const STATES: Record<number, string> = {
  1: 'Starting',
  2: 'Charger disconnected',
  3: 'Idle',
  4: 'Remote control',
  5: 'Cleaning',
  6: 'Returning home',
  7: 'Manual mode',
  8: 'Charging',
  9: 'Charging problem',
  10: 'Paused',
  11: 'Spot cleaning',
  12: 'Error',
  13: 'Shutting down',
  14: 'Updating',
  15: 'Docking',
  16: 'Going to target',
  17: 'Zoned cleaning',
  18: 'Room cleaning',
  22: 'Emptying the bin',
  23: 'Washing the mop',
  26: 'Going to wash the mop',
  29: 'Mapping',
  100: 'Fully charged',
  101: 'Offline',
  103: 'Locked'
}

const ERRORS: Record<number, string> = {
  1: 'Laser sensor blocked',
  2: 'Bumper stuck',
  3: 'Wheels suspended',
  4: 'Cliff sensor error',
  5: 'Main brush jammed',
  6: 'Side brush jammed',
  7: 'Wheels jammed',
  8: 'Robot trapped',
  9: 'No dustbin',
  10: 'Filter is wet or blocked',
  11: 'Strong magnetic field detected',
  12: 'Battery low',
  13: 'Charging error',
  14: 'Battery error',
  15: 'Wall sensor dirty',
  16: 'Robot tilted',
  17: 'Side brush error',
  18: 'Fan error',
  19: 'Dock not connected to power',
  20: 'Optical flow sensor dirty',
  21: 'Vertical bumper pressed',
  22: 'Dock locator error',
  23: 'Could not return to the dock',
  24: 'No-go zone detected',
  25: 'Camera error',
  26: 'Wall sensor error',
  28: 'Robot on carpet',
  29: 'Filter blocked',
  30: 'Invisible wall detected',
  31: 'Cannot cross carpet',
  32: 'Internal error'
}

/** States in which the robot is out doing something, so Pause and Dock make sense. */
const ACTIVE = new Set([1, 4, 5, 6, 7, 11, 15, 16, 17, 18, 29])
const ON_DOCK = new Set([8, 9, 22, 23, 100])

/**
 * Fan power is a percentage on older models (gen 1, S5) and a mode code from
 * 101 on newer ones. The current value says which table the robot speaks.
 */
const FAN_MODES: VacuumFanOption[] = [
  { value: 101, label: 'Quiet' },
  { value: 102, label: 'Balanced' },
  { value: 103, label: 'Turbo' },
  { value: 104, label: 'Max' }
]
const FAN_PERCENT: VacuumFanOption[] = [
  { value: 38, label: 'Quiet' },
  { value: 60, label: 'Balanced' },
  { value: 75, label: 'Turbo' },
  { value: 100, label: 'Max' }
]
const OTHER_FAN_LABELS: Record<number, string> = { 105: 'Gentle', 106: 'Auto', 77: 'Turbo', 90: 'Max' }

export const ROBOROCK_FAN_VALUES = new Set([...FAN_MODES, ...FAN_PERCENT].map(option => option.value))

export function roborockFanOptions(current: number | null): VacuumFanOption[] {
  return current !== null && current >= 101 ? FAN_MODES : FAN_PERCENT
}

function fanLabel(value: number | null) {
  if (value === null) {
    return ''
  }
  const known = [...FAN_MODES, ...FAN_PERCENT].find(option => option.value === value)
  return known?.label || OTHER_FAN_LABELS[value] || (value <= 100 ? `${value}%` : `Mode ${value}`)
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** get_status answers with a one-element list holding the status object. */
export function readRoborockStatus(result: unknown, checkedAt: string): VacuumStatus {
  const raw = (Array.isArray(result) ? result[0] : result) as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object') {
    throw new Error('The vacuum answered without a status')
  }

  const state = numberOrNull(raw.state) ?? 0
  const errorCode = numberOrNull(raw.error_code) ?? 0
  const fanPower = numberOrNull(raw.fan_power)
  const cleanArea = numberOrNull(raw.clean_area)

  return {
    state,
    stateLabel: STATES[state] || `State ${state}`,
    active: ACTIVE.has(state),
    onDock: ON_DOCK.has(state),
    battery: numberOrNull(raw.battery),
    fanPower,
    fanLabel: fanLabel(fanPower),
    fanOptions: roborockFanOptions(fanPower),
    cleanMinutes: Math.round((numberOrNull(raw.clean_time) ?? 0) / 60),
    // The robot reports area in mm².
    cleanAreaM2: cleanArea === null ? null : Math.round(cleanArea / 100_000) / 10,
    errorCode,
    errorLabel: errorCode ? ERRORS[errorCode] || `Error ${errorCode}` : '',
    dndEnabled: raw.dnd_enabled === 1,
    checkedAt
  }
}

/** Seconds of use after which Roborock recommends replacing each part. */
const LIFETIMES = {
  mainBrush: 1_080_000,
  sideBrush: 720_000,
  filter: 540_000,
  sensors: 108_000
}

function percentLeft(used: unknown, lifetime: number) {
  const seconds = numberOrNull(used)
  return seconds === null ? null : Math.max(0, Math.round(100 - (seconds / lifetime) * 100))
}

export function readRoborockConsumables(result: unknown): VacuumConsumables {
  const raw = ((Array.isArray(result) ? result[0] : result) || {}) as Record<string, unknown>
  return {
    mainBrush: percentLeft(raw.main_brush_work_time, LIFETIMES.mainBrush),
    sideBrush: percentLeft(raw.side_brush_work_time, LIFETIMES.sideBrush),
    filter: percentLeft(raw.filter_work_time, LIFETIMES.filter),
    sensors: percentLeft(raw.sensor_dirty_time, LIFETIMES.sensors)
  }
}

/** Older firmware answers get_clean_summary with a list, newer with an object. */
export function readRoborockSummary(result: unknown): VacuumSummary {
  let time: number | null
  let area: number | null
  let count: number | null
  if (Array.isArray(result)) {
    ;[time, area, count] = [numberOrNull(result[0]), numberOrNull(result[1]), numberOrNull(result[2])]
  } else {
    const raw = (result || {}) as Record<string, unknown>
    ;[time, area, count] = [numberOrNull(raw.clean_time), numberOrNull(raw.clean_area), numberOrNull(raw.clean_count)]
  }
  return {
    hours: time === null ? null : Math.round(time / 360) / 10,
    areaM2: area === null ? null : Math.round(area / 1_000_000),
    count
  }
}
