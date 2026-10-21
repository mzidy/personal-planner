import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  decryptResponse,
  encryptedFields,
  encryptedSignature,
  parseXiaomiJson,
  rc4,
  signedNonce,
  xiaomiApiBase,
  xiaomiNonce
} from '../../server/utils/xiaomi-cloud-protocol'
import {
  XiaomiCloudError,
  callXiaomiDevice,
  fetchXiaomiVacuumMap,
  findXiaomiVacuums,
  pollXiaomiQrLogin
} from '../../server/utils/xiaomi-cloud'
import { xiaomiDeviceInputs } from '../../server/utils/smart-home-xiaomi'

/**
 * Expected values were computed with the functions of
 * PiotrMachowski/Xiaomi-cloud-tokens-extractor (token_extractor.py), run
 * unchanged apart from a pure-Python ARC4, for these fixed inputs.
 */
const SSECURITY = 'AAECAwQFBgcICQoLDA0ODw=='
const NONCE = 'AQIDBAUGBwgBudZQ'
const SIGNED = 'wPnqBLjEZww+ask4WAVXTurGZjLsv2tPJLRnQeRQ3Nw='

describe('Xiaomi cloud signing', () => {
  it('implements RC4 (classic test vector, no drop)', () => {
    expect(rc4(Buffer.from('Key'), Buffer.from('Plaintext'), 0).toString('hex')).toBe('bbf316e8d940af0ad3')
  })

  it('builds the nonce from 8 random bytes and the minute count', () => {
    expect(xiaomiNonce(1737374400000, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(NONCE)
  })

  it('signs the nonce with ssecurity', () => {
    expect(signedNonce(SSECURITY, NONCE)).toBe(SIGNED)
  })

  it('encrypts and signs a /home/rpc call exactly as the extractor does', () => {
    const { fields, signed } = encryptedFields('/home/rpc/123456789', { method: 'get_status', params: [] }, SSECURITY, NONCE)
    expect(signed).toBe(SIGNED)
    expect(fields).toEqual({
      data: 'TxrkkHnRuJ6UDtXybB/YuHx65w1sxHZhqtCIs9HfdC4mb70=',
      rc4_hash__: 'ZGvqlnXOmZLAA6e6YybCrERo2FMsshM5iujC7w==',
      signature: '937puYDFv/u5Wb5hA344UMR1UHc=',
      ssecurity: SSECURITY,
      _nonce: NONCE
    })
  })

  it('decrypts an encrypted answer', () => {
    const cipher = 'Txrqmmnc9cCGGNX4bBj0qm9+sUI9iTFh9pOIt8/ZOmBfCJsD69lKZQYNNxuNhSojryJEML5AFh9zJtwWT40='
    expect(JSON.parse(decryptResponse(cipher, SIGNED))).toEqual({ code: 0, message: 'ok', result: [{ state: 8, battery: 100 }] })
  })

  it('knows the API host per server and strips the account response prefix', () => {
    expect(xiaomiApiBase('de')).toBe('https://de.api.io.mi.com/app')
    expect(xiaomiApiBase('cn')).toBe('https://api.io.mi.com/app')
    expect(parseXiaomiJson('&&&START&&&{"qr":"x"}')).toEqual({ qr: 'x' })
  })
})

/**
 * A stand-in for Xiaomi's servers: it checks each request's signature the way
 * the server would, decrypts the fields, and answers encrypted with the same
 * signed nonce.
 */
type Handler = (path: string, data: Record<string, unknown>) => unknown
function fakeCloud(handler: Handler) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const form = new URLSearchParams(init?.body as URLSearchParams)
    const nonce = form.get('_nonce')!
    const signed = signedNonce(form.get('ssecurity')!, nonce)
    const path = url.pathname.replace(/^\/app/, '')
    const encrypted = Object.fromEntries([...form.entries()].filter(([key]) => !['signature', 'ssecurity', '_nonce'].includes(key)))
    if (form.get('signature') !== encryptedSignature('POST', path, encrypted, signed)) {
      return new Response('bad signature', { status: 400 })
    }
    const data = JSON.parse(decryptResponse(form.get('data')!, signed))
    const answer = handler(path, data)
    if (answer instanceof Response) {
      return answer
    }
    return new Response(rc4(Buffer.from(signed, 'base64'), Buffer.from(JSON.stringify(answer))).toString('base64'))
  })
}

const SESSION = { userId: '42', ssecurity: SSECURITY, serviceToken: 'token', agentId: 'ABCDEABCDEABC' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Xiaomi cloud calls', () => {
  it('sends a miio command to the device and returns its result', async () => {
    const fetch = fakeCloud((path, data) => {
      expect(path).toBe('/home/rpc/987')
      expect(data).toEqual({ method: 'app_start', params: [] })
      return { code: 0, message: 'ok', result: ['ok'] }
    })
    vi.stubGlobal('fetch', fetch)
    await expect(callXiaomiDevice(SESSION, 'de', '987', 'app_start')).resolves.toEqual(['ok'])
    expect(String(fetch.mock.calls[0]![0])).toBe('https://de.api.io.mi.com/app/home/rpc/987')
  })

  it('reports an expired session', async () => {
    vi.stubGlobal('fetch', fakeCloud(() => ({ code: 3, message: 'auth err' })))
    const error = await callXiaomiDevice(SESSION, 'de', '987', 'get_status').catch(caught => caught)
    expect(error).toBeInstanceOf(XiaomiCloudError)
    expect(error.sessionExpired).toBe(true)
  })

  it('tells an offline vacuum from a refused command', async () => {
    vi.stubGlobal('fetch', fakeCloud(() => ({ code: -2, message: 'device offline' })))
    const offline = await callXiaomiDevice(SESSION, 'de', '987', 'get_status').catch(caught => caught)
    expect(offline.refused).toBe(false)

    vi.stubGlobal('fetch', fakeCloud(() => ({ code: -10007, message: 'invalid status' })))
    const refused = await callXiaomiDevice(SESSION, 'de', '987', 'app_charge').catch(caught => caught)
    expect(refused.refused).toBe(true)
  })

  it('finds the vacuums across homes, skipping other devices and empty servers', async () => {
    vi.stubGlobal(
      'fetch',
      fakeCloud(path => {
        if (path === '/v2/homeroom/gethome') {
          return { code: 0, result: { homelist: [{ id: 7 }] } }
        }
        if (path === '/v2/user/get_device_cnt') {
          return { code: 0, result: { share: { share_family: [] } } }
        }
        return {
          code: 0,
          result: {
            device_info: [
              { did: '987', name: 'Robot', model: 'roborock.vacuum.s5', isOnline: true, token: 'secret' },
              { did: '555', name: 'Lamp', model: 'yeelink.light.color1', isOnline: true },
              { did: '777', name: 'Dreame', model: 'dreame.vacuum.p2008', isOnline: false }
            ]
          }
        }
      })
    )
    const { server, devices } = await findXiaomiVacuums(SESSION)
    expect(server).toBe('de')
    expect(devices.map(device => device.did)).toEqual(['987', '777'])
    expect(xiaomiDeviceInputs(devices).map(device => [device.duid, device.protocolVersion, device.localKey])).toEqual([
      ['987', 'miio', null],
      ['777', 'miot', null]
    ])
  })
})

describe('QR login', () => {
  it('returns null while the code has not been scanned', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('&&&START&&&{"code":700,"desc":"waiting"}')))
    await expect(pollXiaomiQrLogin('https://account.xiaomi.com/longPolling/lp?x=1', 'AGENT')).resolves.toBeNull()
  })

  it('completes the login, following redirects until the service token is set', async () => {
    const calls: { url: string; cookie: string | null }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        calls.push({ url, cookie: new Headers(init?.headers).get('cookie') })
        if (url.includes('longPolling')) {
          return new Response(
            '&&&START&&&' + JSON.stringify({ ssecurity: SSECURITY, userId: 42, cUserId: 'c42', passToken: 'pt', location: 'https://sts.api.io.mi.com/sts?x=1' })
          )
        }
        if (url.startsWith('https://sts.api.io.mi.com/sts?x=1')) {
          return new Response(null, { status: 302, headers: [['location', '/sts/next'], ['set-cookie', 'step=1; Path=/']] })
        }
        return new Response('ok', { headers: [['set-cookie', 'serviceToken=svc-token; Path=/; HttpOnly']] })
      })
    )
    const session = await pollXiaomiQrLogin('https://account.xiaomi.com/longPolling/lp?x=1', 'AGENT')
    expect(session).toEqual({ userId: '42', ssecurity: SSECURITY, serviceToken: 'svc-token', agentId: 'AGENT' })
    expect(calls[1]!.cookie).toContain('passToken=pt')
    expect(calls[2]).toMatchObject({ url: 'https://sts.api.io.mi.com/sts/next' })
    expect(calls[2]!.cookie).toContain('step=1')
  })
})

describe('map download', () => {
  const MAP = readFileSync(new URL('../fixtures/roborock-maps/s5_fw2008_with_segments.bin', import.meta.url))

  it('asks the vacuum for its map name until it stops saying retry, then downloads and unzips the file', async () => {
    const methods: string[] = []
    let asked = 0
    const cloud = fakeCloud((path, data) => {
      if (path === '/home/rpc/987') {
        methods.push(String(data.method))
        asked += 1
        return { code: 0, result: [asked === 1 ? 'retry' : 'robomap/42/987/0'] }
      }
      expect(path).toBe('/home/getmapfileurl')
      expect(data).toEqual({ obj_name: 'robomap/42/987/0' })
      return { code: 0, result: { url: 'https://files.example/map.gz?sig=1' } }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) =>
        String(input).startsWith('https://files.example/') ? new Response(gzipSync(MAP)) : cloud(input, init)
      )
    )
    const raw = await fetchXiaomiVacuumMap(SESSION, 'de', '987')
    expect(methods).toEqual(['get_map_v1', 'get_map_v1'])
    expect(raw.equals(MAP)).toBe(true)
  })

  it('refuses a download link that is not https', async () => {
    vi.stubGlobal(
      'fetch',
      fakeCloud(path => (path === '/home/getmapfileurl' ? { code: 0, result: { url: 'http://files.example/map.gz' } } : { code: 0, result: ['robomap/1'] }))
    )
    await expect(fetchXiaomiVacuumMap(SESSION, 'de', '987')).rejects.toThrow('download link')
  })
})

