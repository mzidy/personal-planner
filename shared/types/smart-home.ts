export interface VacuumFanOption {
  value: number
  label: string
}

export interface VacuumStatus {
  state: number
  stateLabel: string
  /** Out of the dock doing something, so Pause and Dock make sense. */
  active: boolean
  onDock: boolean
  battery: number | null
  fanPower: number | null
  fanLabel: string
  /** The choices this model understands, judged from the value it reports. */
  fanOptions: VacuumFanOption[]
  /** Duration and area of the current or most recent run. */
  cleanMinutes: number
  cleanAreaM2: number | null
  errorCode: number
  errorLabel: string
  dndEnabled: boolean
  checkedAt: string
}

/** Percent of recommended life left; null when the robot did not report it. */
export interface VacuumConsumables {
  mainBrush: number | null
  sideBrush: number | null
  filter: number | null
  sensors: number | null
}

export interface VacuumSummary {
  hours: number | null
  areaM2: number | null
  count: number | null
}

export interface SmartHomeDevice {
  id: string
  name: string
  model: string
  productName: string
  /** Roborock protocol version; only "1.0" devices can be controlled here. */
  protocolVersion: string
  supported: boolean
  online: boolean
  lastStatus: VacuumStatus | null
}

export interface SmartHomeAccount {
  provider: 'roborock'
  email: string
  /** awaiting_code: a code was sent and not used yet. */
  status: 'awaiting_code' | 'connected'
  region: string
  connectedAt: string | null
}

export interface SmartHomeOverview {
  account: SmartHomeAccount | null
  devices: SmartHomeDevice[]
}

export type VacuumAction = 'start' | 'pause' | 'stop' | 'dock' | 'find' | 'fan'
