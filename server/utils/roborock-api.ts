import { randomBytes } from 'node:crypto'
import { type RoborockRriot, hawkAuthorization, headerClientId } from '~~/server/utils/roborock-protocol'

/**
 * The Roborock account API: find the account's region, send a login code,
 * log in with it, and list the account's devices. Endpoints, headers and
 * error codes follow python-roborock's web_api.py.
 *
 * Login is by emailed code only. The account password never passes through
 * this app; what is kept afterwards is the session Roborock hands back.
 */

const BASE_URLS = [
  'https://usiot.roborock.com',
  'https://euiot.roborock.com',
  'https://cniot.roborock.com',
  'https://ruiot.roborock.com'
]
/** Used only when the latest user agreement version cannot be fetched. */
const DEFAULT_AGREEMENT = { majorVersion: 14, minorVersion: 0 }
const TIMEOUT_MS = 15_000

export class RoborockApiError extends Error {
  constructor(
    message: string,
    readonly code: number | null = null,
    /** The stored session no longer works and the learner has to connect again. */
    readonly sessionExpired = false
  ) {
    super(message)
  }
}

export interface RoborockRegion {
  baseUrl: string
  country: string
  countryCode: string
}

export interface RoborockSession {
  token: string
  rriot: RoborockRriot
}

export interface RoborockDeviceInfo {
  duid: string
  name: string
  localKey: string
  model: string
  productName: string
  protocolVersion: string
  online: boolean
}

interface ApiAnswer {
  code?: number
  msg?: string
  success?: boolean
  data?: unknown
  result?: unknown
}

async function call(
  baseUrl: string,
  path: string,
  options: {
    method?: 'GET' | 'POST'
    query?: Record<string, string>
    form?: Record<string, string | number>
    headers?: Record<string, string>
  } = {}
): Promise<ApiAnswer> {
  const url = new URL(path.replace(/^\//, ''), baseUrl.replace(/\/?$/, '/'))
  for (const [key, value] of Object.entries(options.query || {})) {
    url.searchParams.set(key, value)
  }
  const body = options.form
    ? new URLSearchParams(Object.entries(options.form).map(([key, value]) => [key, String(value)]))
    : undefined

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method || 'POST',
      headers: {
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...options.headers
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch {
    throw new RoborockApiError(`Could not reach Roborock (${url.host}).`)
  }
  try {
    return (await response.json()) as ApiAnswer
  } catch {
    throw new RoborockApiError(`Roborock answered with something other than JSON (HTTP ${response.status}).`)
  }
}

function failure(answer: ApiAnswer, messages: Record<number, string>) {
  const code = typeof answer.code === 'number' ? answer.code : null
  return new RoborockApiError((code !== null && messages[code]) || `Roborock said: ${answer.msg || 'unknown error'} (code ${code ?? '?'}).`, code)
}

export function newClientIdentifier() {
  return randomBytes(16).toString('base64url')
}

/** Asks each regional server in turn which region the account lives in. */
export async function findRoborockRegion(email: string, baseUrls = BASE_URLS): Promise<RoborockRegion> {
  for (const baseUrl of baseUrls) {
    let answer: ApiAnswer
    try {
      answer = await call(baseUrl, '/api/v1/getUrlByEmail', { query: { email, needtwostepauth: 'false' } })
    } catch {
      continue
    }
    if (answer.code !== 200) {
      throw failure(answer, {
        2003: 'That email address is not formatted correctly.',
        1001: 'Roborock needs an email address for this.'
      })
    }
    const data = (answer.data || {}) as { url?: string; country?: string | null; countrycode?: string | number | null }
    if (data.url && (data.country || data.countrycode)) {
      return { baseUrl: data.url, country: data.country || '', countryCode: data.countrycode ? String(data.countrycode) : '' }
    }
  }
  throw new RoborockApiError('No Roborock account was found for this email on any Roborock server.')
}

const CODE_ERRORS = {
  2008: 'No Roborock account uses this email. A Mi Home account is not the same as a Roborock app account.',
  9002: 'Too many codes were requested. Wait a while and try again.'
}

/** Sends the login code by email. Returns the region actually used, which can change on code 3030. */
export async function requestRoborockCode(region: RoborockRegion, email: string, clientIdentifier: string): Promise<RoborockRegion> {
  const headers = { header_clientid: headerClientId(email, clientIdentifier), header_clientlang: 'en' }

  if (!region.country || !region.countryCode) {
    const answer = await call(region.baseUrl, '/api/v1/sendEmailCode', {
      query: { username: email, type: 'auth' },
      headers: { header_clientid: headers.header_clientid }
    })
    if (answer.code !== 200) {
      throw failure(answer, CODE_ERRORS)
    }
    return region
  }

  const answer = await call(region.baseUrl, '/api/v4/email/code/send', {
    form: { email, type: 'login', platform: '' },
    headers
  })
  if (answer.code === 3030) {
    // This server will not send codes for the account; the reference retries the region lookup on the next ones.
    const rest = BASE_URLS.slice(BASE_URLS.indexOf(region.baseUrl) + 1)
    if (rest.length) {
      return requestRoborockCode(await findRoborockRegion(email, rest), email, clientIdentifier)
    }
  }
  if (answer.code !== 200) {
    throw failure(answer, CODE_ERRORS)
  }
  return region
}

async function agreementVersion(baseUrl: string, country: string) {
  try {
    const answer = await call(baseUrl, '/api/v3/app/agreement/latest', {
      method: 'GET',
      query: { country },
      headers: { header_clientlang: 'en' }
    })
    const data = (answer.data || {}) as { majorVersion?: unknown; minorVersion?: unknown }
    if (answer.code === 200 && typeof data.majorVersion === 'number' && typeof data.minorVersion === 'number') {
      return { majorVersion: data.majorVersion, minorVersion: data.minorVersion }
    }
  } catch {
    // The login itself says if the version is stale.
  }
  return DEFAULT_AGREEMENT
}

const LOGIN_ERRORS = {
  2018: 'That code is not right. Check the latest email from Roborock and try again.',
  3009: 'Accept the user agreement in the Roborock app first, then try again.',
  3006: 'Roborock wants its user agreement accepted again in the app. (This also happens with a Mi Home account.)',
  3039: 'No Roborock account was found for this email in its region.'
}

function readSession(data: unknown): RoborockSession {
  const session = data as Partial<RoborockSession> | null
  if (!session?.token || !session.rriot?.u || !session.rriot.k || !session.rriot.r?.a || !session.rriot.r.m) {
    throw new RoborockApiError('Roborock logged in but did not return a usable session.')
  }
  return { token: session.token, rriot: session.rriot }
}

export async function loginRoborockWithCode(
  region: RoborockRegion,
  email: string,
  clientIdentifier: string,
  code: string
): Promise<RoborockSession> {
  const clientId = headerClientId(email, clientIdentifier)

  if (!region.country || !region.countryCode) {
    const answer = await call(region.baseUrl, '/api/v1/loginWithCode', {
      query: { username: email, verifycode: code, verifycodetype: 'AUTH_EMAIL_CODE' },
      headers: { header_clientid: clientId }
    })
    if (answer.code !== 200) {
      throw failure(answer, LOGIN_ERRORS)
    }
    return readSession(answer.data)
  }

  // The v4 login wants a random string signed by the server alongside it.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const unsigned = Array.from(randomBytes(16), byte => alphabet[byte % alphabet.length]).join('')
  const signed = await call(region.baseUrl, '/api/v3/key/sign', { query: { s: unsigned }, headers: { header_clientid: clientId } })
  const signature = (signed.data as { k?: string } | undefined)?.k
  if (signed.code !== 200 || !signature) {
    throw failure(signed, {})
  }

  const answer = await call(region.baseUrl, '/api/v4/auth/email/login/code', {
    form: {
      country: region.country,
      countryCode: region.countryCode,
      email,
      code,
      ...(await agreementVersion(region.baseUrl, region.country))
    },
    headers: {
      header_clientid: clientId,
      'x-mercy-ks': unsigned,
      'x-mercy-k': signature,
      header_clientlang: 'en',
      header_appversion: '4.54.02',
      header_phonesystem: 'iOS',
      header_phonemodel: 'iPhone16,1'
    }
  })
  if (answer.code !== 200) {
    throw failure(answer, LOGIN_ERRORS)
  }
  return readSession(answer.data)
}

/** Every device on the account's home, own and shared. */
export async function listRoborockDevices(
  region: RoborockRegion,
  email: string,
  clientIdentifier: string,
  session: RoborockSession
): Promise<RoborockDeviceInfo[]> {
  const home = await call(region.baseUrl, '/api/v1/getHomeDetail', {
    method: 'GET',
    headers: { header_clientid: headerClientId(email, clientIdentifier), Authorization: session.token }
  })
  if (home.code === 2010) {
    throw new RoborockApiError('The Roborock session has expired. Connect the account again.', 2010, true)
  }
  const homeId = (home.data as { rrHomeId?: number | string } | undefined)?.rrHomeId
  if (home.code !== 200 || homeId === undefined) {
    throw failure(home, {})
  }

  const path = `/v3/user/homes/${homeId}`
  const answer = await call(session.rriot.r.a, path, {
    method: 'GET',
    headers: { Authorization: hawkAuthorization(session.rriot, path) }
  })
  if (!answer.success) {
    throw new RoborockApiError(`Roborock would not list the home's devices: ${answer.msg || 'unknown error'}.`)
  }

  const result = (answer.result || {}) as {
    products?: { id: string | number; name?: string; model?: string }[]
    devices?: Record<string, unknown>[]
    receivedDevices?: Record<string, unknown>[]
  }
  const products = new Map((result.products || []).map(product => [String(product.id), product]))

  return [...(result.devices || []), ...(result.receivedDevices || [])]
    .filter(device => typeof device.duid === 'string' && typeof device.localKey === 'string')
    .map(device => {
      const product = products.get(String(device.productId))
      return {
        duid: device.duid as string,
        name: typeof device.name === 'string' ? device.name : 'Roborock',
        localKey: device.localKey as string,
        model: product?.model || '',
        productName: product?.name || '',
        protocolVersion: typeof device.pv === 'string' ? device.pv : '1.0',
        online: device.online !== false
      }
    })
}
