import { createHash, randomBytes } from 'node:crypto'

/**
 * Signing and encryption for Xiaomi's cloud API (the one the Xiaomi Home app
 * uses), following PiotrMachowski/Xiaomi-cloud-tokens-extractor (MIT) and
 * merdok/homebridge-miot (MIT). Pure functions only, so tests can check them
 * against vectors computed from the Python reference.
 *
 * Every request carries a nonce; sha256(ssecurity + nonce) is the "signed
 * nonce", which keys RC4 (with the first 1024 bytes of keystream dropped) for
 * both the request fields and the response.
 */

export const XIAOMI_SERVERS = ['de', 'cn', 'us', 'ru', 'tw', 'sg', 'in', 'i2'] as const

export function xiaomiApiBase(server: string) {
  return `https://${server === 'cn' ? '' : `${server}.`}api.io.mi.com/app`
}

/**
 * RC4 with the first `drop` bytes of keystream discarded, as Xiaomi uses it.
 * Node's OpenSSL 3 no longer offers RC4, so it is implemented here.
 */
export function rc4(key: Buffer, data: Buffer, drop = 1024) {
  const s = Array.from({ length: 256 }, (_, index) => index)
  let j = 0
  for (let i = 0; i < 256; i += 1) {
    j = (j + s[i]! + key[i % key.length]!) & 255
    ;[s[i], s[j]] = [s[j]!, s[i]!]
  }
  let i = 0
  j = 0
  const next = () => {
    i = (i + 1) & 255
    j = (j + s[i]!) & 255
    ;[s[i], s[j]] = [s[j]!, s[i]!]
    return s[(s[i]! + s[j]!) & 255]!
  }
  for (let n = 0; n < drop; n += 1) {
    next()
  }
  const out = Buffer.alloc(data.length)
  for (let n = 0; n < data.length; n += 1) {
    out[n] = data[n]! ^ next()
  }
  return out
}

/** 8 random bytes and the minute count, base64. */
export function xiaomiNonce(millis = Date.now(), random = randomBytes(8)) {
  const minutes = Buffer.alloc(4)
  minutes.writeUInt32BE(Math.floor(millis / 60_000))
  return Buffer.concat([random, minutes]).toString('base64')
}

export function signedNonce(ssecurity: string, nonce: string) {
  return createHash('sha256').update(Buffer.from(ssecurity, 'base64')).update(Buffer.from(nonce, 'base64')).digest('base64')
}

/** sha1 over METHOD & path & sorted key=value pairs & signed nonce. The path drops the leading /app. */
export function encryptedSignature(method: string, path: string, params: Record<string, string>, signed: string) {
  const parts = [method.toUpperCase(), path, ...Object.keys(params).sort().map(key => `${key}=${params[key]}`), signed]
  return createHash('sha1').update(parts.join('&')).digest('base64')
}

/**
 * The form fields for an encrypted call to `path` (for example "/home/rpc/123",
 * without the /app prefix): every value RC4-encrypted, plus the two signatures,
 * ssecurity and the nonce.
 */
export function encryptedFields(path: string, data: unknown, ssecurity: string, nonce: string) {
  const signed = signedNonce(ssecurity, nonce)
  const key = Buffer.from(signed, 'base64')
  const params: Record<string, string> = { data: JSON.stringify(data) }
  params.rc4_hash__ = encryptedSignature('POST', path, params, signed)
  for (const name of Object.keys(params)) {
    params[name] = rc4(key, Buffer.from(params[name]!, 'utf8')).toString('base64')
  }
  return {
    fields: { ...params, signature: encryptedSignature('POST', path, params, signed), ssecurity, _nonce: nonce },
    signed
  }
}

export function decryptResponse(body: string, signed: string) {
  return rc4(Buffer.from(signed, 'base64'), Buffer.from(body.trim(), 'base64')).toString('utf8')
}

/** Account responses start with &&&START&&& before the JSON. */
export function parseXiaomiJson<T = Record<string, unknown>>(text: string): T {
  return JSON.parse(text.replace(/^&&&START&&&/, '')) as T
}

/** Same shape as the Xiaomi Home app's user agent, with a per-account id. */
export function xiaomiUserAgent(agentId: string) {
  return `Android-7.1.1-1.0.0-ONEPLUS A3010-136-${agentId} APP/com.xiaomi.mihome APPV/10.5.201`
}

export function newXiaomiAgentId() {
  const letters = 'ABCDE'
  return Array.from(randomBytes(13), byte => letters[byte % letters.length]).join('')
}
