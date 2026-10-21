import { gunzipSync } from 'node:zlib'
import {
  XIAOMI_SERVERS,
  decryptResponse,
  encryptedFields,
  parseXiaomiJson,
  xiaomiApiBase,
  xiaomiNonce,
  xiaomiUserAgent
} from '~~/server/utils/xiaomi-cloud-protocol'

/**
 * Xiaomi's cloud, as the Xiaomi Home app uses it: log in by scanning a QR
 * code in the app, list the account's devices, and send miio commands to a
 * device through the cloud (/home/rpc/{did}), which reaches it wherever it is.
 *
 * QR login means no password ever passes through this app, and it avoids the
 * extra identity checks Xiaomi puts on password logins from a new server.
 * Flow and endpoints follow Xiaomi-cloud-tokens-extractor and homebridge-miot.
 */

const TIMEOUT_MS = 15_000

export class XiaomiCloudError extends Error {
  constructor(
    message: string,
    /** The stored session no longer works; scan a new code. */
    readonly sessionExpired = false,
    /** The device answered and refused, as opposed to not being reached. */
    readonly refused = false
  ) {
    super(message)
  }
}

export interface XiaomiSession {
  userId: string
  ssecurity: string
  serviceToken: string
  agentId: string
}

export interface XiaomiQrLogin {
  qrImageUrl: string
  loginUrl: string
  pollUrl: string
  expiresAt: string
}

export interface XiaomiDeviceInfo {
  did: string
  name: string
  model: string
  online: boolean
}

// ---------------------------------------------------------------- QR login

export async function startXiaomiQrLogin(agentId: string): Promise<XiaomiQrLogin> {
  const url = new URL('https://account.xiaomi.com/longPolling/loginUrl')
  url.searchParams.set('_qrsize', '480')
  url.searchParams.set('qs', '?sid=xiaomiio&_json=true')
  url.searchParams.set('callback', 'https://sts.api.io.mi.com/sts')
  url.searchParams.set('_hasLogo', 'false')
  url.searchParams.set('sid', 'xiaomiio')
  url.searchParams.set('serviceParam', '')
  url.searchParams.set('_locale', 'en_GB')
  url.searchParams.set('_dc', String(Date.now()))

  let text: string
  try {
    const response = await fetch(url, { headers: { 'User-Agent': xiaomiUserAgent(agentId) }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    text = await response.text()
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
  } catch (error) {
    throw new XiaomiCloudError(`Xiaomi would not start a QR login: ${(error as Error).message}.`)
  }

  const data = parseXiaomiJson<{ qr?: string; loginUrl?: string; lp?: string; timeout?: number }>(text)
  if (!data.qr || !data.lp) {
    throw new XiaomiCloudError('Xiaomi did not return a QR code.')
  }
  return {
    qrImageUrl: data.qr,
    loginUrl: data.loginUrl || '',
    pollUrl: data.lp,
    expiresAt: new Date(Date.now() + (data.timeout || 300) * 1000).toISOString()
  }
}

/** Set-Cookie values from one response, as name → value. */
function setCookies(response: Response) {
  const cookies: Record<string, string> = {}
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0] || ''
    const at = pair.indexOf('=')
    if (at > 0) {
      cookies[pair.slice(0, at).trim()] = pair.slice(at + 1).trim()
    }
  }
  return cookies
}

/** Follows the login's location, carrying cookies across redirects, until a serviceToken is set. */
async function fetchServiceToken(location: string, cookies: Record<string, string>, agentId: string) {
  let url = location
  const jar = { ...cookies }
  for (let hop = 0; hop < 6; hop += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': xiaomiUserAgent(agentId),
        Cookie: Object.entries(jar)
          .map(([name, value]) => `${name}=${value}`)
          .join('; ')
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    Object.assign(jar, setCookies(response))
    if (jar.serviceToken) {
      return jar.serviceToken
    }
    const next = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && next) {
      url = new URL(next, url).toString()
      continue
    }
    break
  }
  throw new XiaomiCloudError('Xiaomi confirmed the login but did not hand out a service token.')
}

/**
 * Waits (long-polls) for the code to be scanned and confirmed. Returns null
 * if it has not been yet, so the page can ask again.
 */
export async function pollXiaomiQrLogin(pollUrl: string, agentId: string, waitMs = 20_000): Promise<XiaomiSession | null> {
  const url = new URL(pollUrl)
  url.searchParams.set('_', String(Date.now()))

  let text: string
  try {
    const response = await fetch(url, { headers: { 'User-Agent': xiaomiUserAgent(agentId) }, signal: AbortSignal.timeout(waitMs) })
    text = await response.text()
    if (!response.ok) {
      return null
    }
  } catch {
    // The long poll ran out of time without a scan; that is the normal case.
    return null
  }

  let data: { ssecurity?: string; userId?: string | number; cUserId?: string; passToken?: string; location?: string }
  try {
    data = parseXiaomiJson(text)
  } catch {
    return null
  }
  if (!data.ssecurity || !data.userId || !data.location) {
    return null
  }

  const cookies: Record<string, string> = { userId: String(data.userId) }
  if (data.cUserId) {
    cookies.cUserId = data.cUserId
  }
  if (data.passToken) {
    cookies.passToken = data.passToken
  }
  const serviceToken = await fetchServiceToken(data.location, cookies, agentId)
  return { userId: String(data.userId), ssecurity: data.ssecurity, serviceToken, agentId }
}

// ---------------------------------------------------------------- API calls

interface ApiAnswer {
  code?: number
  message?: string
  result?: unknown
}

async function apiCall(session: XiaomiSession, server: string, path: string, data: unknown): Promise<ApiAnswer> {
  const { fields, signed } = encryptedFields(path, data, session.ssecurity, xiaomiNonce())

  let response: Response
  try {
    response = await fetch(xiaomiApiBase(server) + path, {
      method: 'POST',
      headers: {
        'User-Agent': xiaomiUserAgent(session.agentId),
        'Accept-Encoding': 'identity',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
        'MIOT-ENCRYPT-ALGORITHM': 'ENCRYPT-RC4',
        Cookie: [
          `userId=${session.userId}`,
          `yetAnotherServiceToken=${session.serviceToken}`,
          `serviceToken=${session.serviceToken}`,
          'locale=en_GB',
          'channel=MI_APP_STORE'
        ].join('; ')
      },
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch {
    throw new XiaomiCloudError(`Could not reach Xiaomi's cloud (${server}).`)
  }

  const text = await response.text()
  if (response.status === 401 || response.status === 403) {
    throw new XiaomiCloudError('The Xiaomi session has expired. Scan a new code to connect again.', true)
  }

  let answer: ApiAnswer
  try {
    answer = JSON.parse(decryptResponse(text, signed)) as ApiAnswer
  } catch {
    // Errors sometimes come back unencrypted.
    try {
      answer = JSON.parse(text) as ApiAnswer
    } catch {
      throw new XiaomiCloudError(`Xiaomi's cloud answered with something unreadable (HTTP ${response.status}).`)
    }
  }
  if (answer.code === 2 || answer.code === 3) {
    throw new XiaomiCloudError('The Xiaomi session has expired. Scan a new code to connect again.', true)
  }
  return answer
}

const VACUUM = /\.vacuum\./

async function homesOn(session: XiaomiSession, server: string) {
  const homes: { id: string | number; owner: string | number }[] = []
  const list = await apiCall(session, server, '/v2/homeroom/gethome', {
    fg: true,
    fetch_share: true,
    fetch_share_dev: true,
    limit: 300,
    app_ver: 7
  })
  for (const home of ((list.result as { homelist?: { id: string | number }[] })?.homelist || [])) {
    homes.push({ id: home.id, owner: session.userId })
  }
  const shared = await apiCall(session, server, '/v2/user/get_device_cnt', { fetch_own: true, fetch_share: true })
  const family = (shared.result as { share?: { share_family?: { home_id: string | number; home_owner: string | number }[] } })?.share?.share_family
  for (const home of family || []) {
    homes.push({ id: home.home_id, owner: home.home_owner })
  }
  return homes
}

/**
 * The account's vacuums and the server they live on. Xiaomi keeps each
 * region separate, so servers are tried in turn (Europe first) until one
 * has devices.
 */
export async function findXiaomiVacuums(session: XiaomiSession): Promise<{ server: string; devices: XiaomiDeviceInfo[] }> {
  let lastError: unknown = null
  for (const server of XIAOMI_SERVERS) {
    try {
      const devices: XiaomiDeviceInfo[] = []
      for (const home of await homesOn(session, server)) {
        const answer = await apiCall(session, server, '/v2/home/home_device_list', {
          home_owner: Number(home.owner),
          home_id: Number(home.id),
          limit: 200,
          get_split_device: true,
          support_smart_home: true
        })
        const info = (answer.result as { device_info?: Record<string, unknown>[] | null })?.device_info || []
        for (const device of info) {
          if (typeof device.did === 'string' && typeof device.model === 'string' && VACUUM.test(device.model)) {
            devices.push({
              did: device.did,
              name: typeof device.name === 'string' ? device.name : device.model,
              model: device.model,
              online: device.isOnline !== false
            })
          }
        }
      }
      if (devices.length) {
        return { server, devices }
      }
    } catch (error) {
      if (error instanceof XiaomiCloudError && error.sessionExpired) {
        throw error
      }
      lastError = error
    }
  }
  if (lastError) {
    throw lastError
  }
  return { server: XIAOMI_SERVERS[0], devices: [] }
}

/** One miio command to a device, relayed by Xiaomi's cloud. */
export async function callXiaomiDevice(session: XiaomiSession, server: string, did: string, method: string, params: unknown[] = []) {
  const answer = await apiCall(session, server, `/home/rpc/${did}`, { method, params })
  if (answer.code !== undefined && answer.code !== 0) {
    const offline = /offline|timeout/i.test(answer.message || '')
    throw new XiaomiCloudError(
      offline
        ? 'The vacuum did not answer through Xiaomi\'s cloud. It may be offline or out of Wi-Fi range.'
        : `Xiaomi's cloud refused the command: ${answer.message || `code ${answer.code}`}.`,
      false,
      !offline
    )
  }
  const result = answer.result
  if (result === 'unknown_method') {
    throw new XiaomiCloudError('This vacuum does not support that command.', false, true)
  }
  return result
}

/**
 * The vacuum's current map file, as uploaded to Xiaomi's storage. The vacuum
 * names it (get_map_v1, which sometimes answers "retry" while it uploads),
 * the cloud signs a download URL for that name, and the file is gzip.
 */
export async function fetchXiaomiVacuumMap(session: XiaomiSession, server: string, did: string): Promise<Buffer> {
  let name = ''
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await callXiaomiDevice(session, server, did, 'get_map_v1')
    const candidate = Array.isArray(result) ? result[0] : result
    if (typeof candidate === 'string' && candidate && candidate !== 'retry') {
      name = candidate
      break
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
  }
  if (!name) {
    throw new XiaomiCloudError('The vacuum has no map to share right now. Try again in a minute.', false, true)
  }

  const answer = await apiCall(session, server, '/home/getmapfileurl', { obj_name: name })
  const url = (answer.result as { url?: unknown } | null)?.url
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new XiaomiCloudError('Xiaomi did not hand out a download link for the map.')
  }

  let file: Buffer
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    file = Buffer.from(await response.arrayBuffer())
  } catch (error) {
    throw new XiaomiCloudError(`The map could not be downloaded: ${(error as Error).message}.`)
  }
  try {
    return gunzipSync(file)
  } catch {
    throw new XiaomiCloudError('The map file was not in the expected format.')
  }
}

