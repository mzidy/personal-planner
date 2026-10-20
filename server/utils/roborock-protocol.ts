import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

/**
 * The Roborock cloud protocol for "1.0" (V1) devices, ported from
 * python-roborock (github.com/Python-roborock/python-roborock, Apache-2.0):
 * roborock/protocol.py, protocols/v1_protocol.py and web_api.py.
 *
 * Pure functions only, no network, so every byte can be checked in tests
 * against vectors from that library.
 *
 * A message on the wire:
 *
 *   version(3) "1.0" | seq u32 | random u32 | timestamp u32 | protocol u16
 *   | payload length u16 | payload, AES-128-ECB | crc32 u32
 *
 * all big-endian. The AES key is md5(encodeTimestamp(timestamp) + localKey + SALT),
 * so every message has its own key.
 */

export const ROBOROCK_SALT = 'TXdfu$jyZ#TZHsg4'
export const RPC_REQUEST = 101
export const RPC_RESPONSE = 102

const VERSIONS = new Set(['1.0', 'A01', 'B01', 'L01'])
const HEADER_LENGTH = 3 + 4 + 4 + 4 + 2

export interface RoborockRriot {
  u: string
  s: string
  h: string
  k: string
  r: { r?: string; a: string; m: string; l?: string }
}

export interface RoborockMessage {
  version: string
  seq: number
  random: number
  timestamp: number
  protocol: number
  /** Decrypted payload; null when the frame carries none or a version this port cannot decrypt. */
  payload: Buffer | null
}

export function md5Hex(text: string) {
  return createHash('md5').update(text).digest('hex')
}

/** The timestamp's hex digits, shuffled. Part of every message key. */
export function encodeTimestamp(timestamp: number) {
  const hex = timestamp.toString(16).padStart(8, '0')
  return [5, 6, 3, 7, 1, 2, 0, 4].map(index => hex[index]).join('')
}

export function messageKey(timestamp: number, localKey: string) {
  return createHash('md5')
    .update(Buffer.concat([Buffer.from(encodeTimestamp(timestamp)), Buffer.from(localKey), Buffer.from(ROBOROCK_SALT)]))
    .digest()
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

/** The same CRC-32 as Python's binascii.crc32. */
export function crc32(data: Buffer) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function encryptEcb(plaintext: Buffer, key: Buffer) {
  if (!plaintext.length) {
    return plaintext
  }
  // Node pads with PKCS#7 by default, which is what pycryptodome's pad() does.
  const cipher = createCipheriv('aes-128-ecb', key, null)
  return Buffer.concat([cipher.update(plaintext), cipher.final()])
}

function decryptEcb(ciphertext: Buffer, key: Buffer) {
  if (!ciphertext.length) {
    return ciphertext
  }
  const decipher = createDecipheriv('aes-128-ecb', key, null)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function buildMessage(message: Omit<RoborockMessage, 'version' | 'payload'> & { payload: Buffer }, localKey: string) {
  const encrypted = encryptEcb(message.payload, messageKey(message.timestamp, localKey))
  const head = Buffer.alloc(HEADER_LENGTH + 2)
  head.write('1.0', 0, 'latin1')
  head.writeUInt32BE(message.seq >>> 0, 3)
  head.writeUInt32BE(message.random >>> 0, 7)
  head.writeUInt32BE(message.timestamp >>> 0, 11)
  head.writeUInt16BE(message.protocol, 15)
  head.writeUInt16BE(encrypted.length, 17)
  const body = Buffer.concat([head, encrypted])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([body, checksum])
}

/**
 * Parses every message in a buffer. Bytes before a valid version marker are
 * skipped, as the reference does. A frame whose checksum does not match is an
 * error rather than something to guess at.
 */
export function parseMessages(data: Buffer, localKey: string): RoborockMessage[] {
  const messages: RoborockMessage[] = []
  let offset = 0

  while (offset + HEADER_LENGTH <= data.length) {
    let start = offset
    while (start + 3 <= data.length && !VERSIONS.has(data.toString('latin1', start, start + 3))) {
      start += 1
    }
    if (start + HEADER_LENGTH > data.length) {
      break
    }

    const version = data.toString('latin1', start, start + 3)
    const seq = data.readUInt32BE(start + 3)
    const random = data.readUInt32BE(start + 7)
    const timestamp = data.readUInt32BE(start + 11)
    const protocol = data.readUInt16BE(start + 15)
    let cursor = start + HEADER_LENGTH

    if (cursor + 2 > data.length) {
      messages.push({ version, seq, random, timestamp, protocol, payload: null })
      break
    }
    const length = data.readUInt16BE(cursor)
    cursor += 2
    if (cursor + length + 4 > data.length) {
      throw new Error('Roborock message is shorter than its declared length')
    }
    const encrypted = data.subarray(cursor, cursor + length)
    cursor += length

    const expected = data.readUInt32BE(cursor)
    const actual = crc32(data.subarray(start, cursor))
    if (expected !== actual) {
      throw new Error('Roborock message checksum does not match')
    }
    cursor += 4

    const payload = version === '1.0' && length ? decryptEcb(encrypted, messageKey(timestamp, localKey)) : null
    messages.push({ version, seq, random, timestamp, protocol, payload })
    offset = cursor
  }

  return messages
}

// ---------------------------------------------------------------- V1 RPC payloads

export interface RoborockSecurity {
  endpoint: string
  nonce: Buffer
}

/** Sent with every cloud request; the endpoint is derived from the account's k value. */
export function createSecurity(rriot: Pick<RoborockRriot, 'k'>, nonce = randomBytes(16)): RoborockSecurity {
  const endpoint = createHash('md5').update(rriot.k).digest().subarray(8, 14).toString('base64')
  return { endpoint, nonce }
}

export function rpcRequestPayload(request: {
  id: number
  method: string
  params?: unknown[] | Record<string, unknown> | number | null
  timestamp: number
  security?: RoborockSecurity
}) {
  const inner = JSON.stringify({
    id: request.id,
    method: request.method,
    params: request.params || [],
    ...(request.security
      ? { security: { endpoint: request.security.endpoint, nonce: request.security.nonce.toString('hex') } }
      : {})
  })
  return Buffer.from(JSON.stringify({ dps: { '101': inner }, t: request.timestamp }))
}

export interface RpcResponse {
  id: number | null
  result: unknown
  error: unknown
}

/** The RPC answer inside a payload, or null when the payload is a status push or something else. */
export function decodeRpcResponse(payload: Buffer): RpcResponse | null {
  let outer: { dps?: Record<string, unknown> }
  try {
    outer = JSON.parse(payload.toString('utf8'))
  } catch {
    return null
  }
  const point = outer?.dps?.[String(RPC_RESPONSE)]
  if (typeof point !== 'string') {
    return null
  }
  try {
    const inner = JSON.parse(point) as { id?: number; result?: unknown; error?: unknown }
    return { id: typeof inner.id === 'number' ? inner.id : null, result: inner.result ?? null, error: inner.error ?? null }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- web API and MQTT credentials

/** header_clientid: base64(md5(email + a per-client identifier)), kept the same from code request to login. */
export function headerClientId(email: string, clientIdentifier: string) {
  return createHash('md5').update(email + clientIdentifier).digest('base64')
}

function hawkValues(values: Record<string, string | number> | undefined) {
  if (!values) {
    return ''
  }
  const joined = Object.keys(values)
    .sort()
    .map(key => `${key}=${values[key]}`)
    .join('&')
  return md5Hex(joined)
}

/** Authorization header for the per-region device API (rriot.r.a). */
export function hawkAuthorization(
  rriot: Pick<RoborockRriot, 'u' | 's' | 'h'>,
  path: string,
  options: {
    params?: Record<string, string | number>
    formdata?: Record<string, string | number>
    timestamp?: number
    nonce?: string
  } = {}
) {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000)
  const nonce = options.nonce ?? randomBytes(6).toString('base64url')
  const prestr = [
    rriot.u,
    rriot.s,
    nonce,
    String(timestamp),
    md5Hex(path),
    hawkValues(options.params),
    hawkValues(options.formdata)
  ].join(':')
  const mac = createHmac('sha256', rriot.h).update(prestr).digest('base64')
  return `Hawk id="${rriot.u}",s="${rriot.s}",ts="${timestamp}",nonce="${nonce}",mac="${mac}"`
}

export function mqttParams(rriot: RoborockRriot) {
  const url = new URL(rriot.r.m)
  if (!url.hostname || !url.port) {
    throw new Error(`The account's MQTT address "${rriot.r.m}" has no host or port`)
  }
  return {
    url: `${url.protocol === 'ssl:' ? 'mqtts' : 'mqtt'}://${url.hostname}:${url.port}`,
    username: md5Hex(`${rriot.u}:${rriot.k}`).slice(2, 10),
    password: md5Hex(`${rriot.s}:${rriot.k}`).slice(16)
  }
}

export function mqttTopics(rriot: Pick<RoborockRriot, 'u'>, username: string, duid: string) {
  return {
    publish: `rr/m/i/${rriot.u}/${username}/${duid}`,
    subscribe: `rr/m/o/${rriot.u}/${username}/${duid}`
  }
}
