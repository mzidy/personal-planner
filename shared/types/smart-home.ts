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

export type SmartHomeProvider = 'roborock' | 'xiaomi'

export interface SmartHomeDevice {
  id: string
  provider: SmartHomeProvider
  name: string
  model: string
  productName: string
  /**
   * Roborock: the device protocol ("1.0" is controllable). Xiaomi: "miio" for
   * Roborock-made vacuums, which take the same commands, "miot" for others.
   */
  protocolVersion: string
  supported: boolean
  online: boolean
  lastStatus: VacuumStatus | null
}

export interface SmartHomeAccount {
  provider: SmartHomeProvider
  /** The Roborock email, or the Xiaomi account id once connected. */
  email: string
  /** awaiting_code: a Roborock code was sent. awaiting_scan: a Xiaomi QR code is waiting to be scanned. */
  status: 'awaiting_code' | 'awaiting_scan' | 'connected'
  region: string
  connectedAt: string | null
  /** While a Xiaomi QR login is open: the code to scan and when it stops working. */
  qrImageUrl: string | null
  qrExpiresAt: string | null
}

export interface SmartHomeOverview {
  accounts: Record<SmartHomeProvider, SmartHomeAccount | null>
  devices: SmartHomeDevice[]
}

export type VacuumAction = 'start' | 'pause' | 'stop' | 'dock' | 'find' | 'fan'

/**
 * A vacuum's map, ready to draw: cropped to what was mapped, rows top-down,
 * coordinates in pixels of the crop (one pixel is 5 cm).
 */
export interface VacuumMapView {
  width: number
  height: number
  /** base64, one byte per pixel: 0 outside, 1 wall, 2 floor, 3 scanned, 4 obstacle, 16 + n room n. */
  pixels: string
  charger: [number, number] | null
  /** x, y and heading in degrees. */
  robot: [number, number, number] | null
  /** Flattened x, y pairs of the current or last run. */
  path: number[]
  noGo: number[][]
  noMop: number[][]
  walls: number[][]
  zones: number[][]
  rooms: number[]
  mapIndex: number
  fetchedAt: string
}
