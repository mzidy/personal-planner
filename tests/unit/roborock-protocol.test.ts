import { describe, expect, it } from 'vitest'
import {
  buildMessage,
  crc32,
  createSecurity,
  decodeRpcResponse,
  encodeTimestamp,
  hawkAuthorization,
  headerClientId,
  messageKey,
  mqttParams,
  mqttTopics,
  parseMessages,
  rpcRequestPayload
} from '../../server/utils/roborock-protocol'
import { readRoborockConsumables, readRoborockStatus, readRoborockSummary, roborockFanOptions } from '../../shared/utils/roborock-status'

/**
 * Account values from python-roborock's tests/mock_data.py. The binary frame,
 * Hawk MACs and MQTT credentials were computed separately with Python's
 * standard library and the openssl CLI, following python-roborock's
 * protocol.py field by field, so these tests do not just check the port
 * against itself.
 */
const RRIOT = {
  u: 'user123',
  s: 'pass123',
  h: 'unknown123',
  k: 'qiCNieZa',
  r: { r: 'US', a: 'https://api-us.roborock.com', m: 'ssl://mqtt-us.roborock.com:8883' }
}
const LOCAL_KEY = 'key123key123key1'
const TIMESTAMP = 1737374400
const NONCE = Buffer.from('91be10c9622b9d8acd482a19f6fe8168', 'hex')

// python-roborock tests/protocols/test_v1_protocol.py, test_encode_mqtt_payload
const GET_STATUS_PAYLOAD =
  '{"dps":{"101":"{\\"id\\":44444,\\"method\\":\\"get_status\\",\\"params\\":[],\\"security\\":{\\"endpoint\\":\\"87ItGWdb\\",\\"nonce\\":\\"91be10c9622b9d8acd482a19f6fe8168\\"}}"},"t":1737374400}'

const FRAME_HEX =
  '312e300001e2400000d431678e3ac0006500b0898384cc94d6962d0768ab27d9a4d96aaf83cc49b74932f02be1c99fa4d1a789a2a54a492f119f5491306964b5dce5964d89e34358b20a381a62e03ecadc63803a2c21b1725d090f06b6cecff9f42dd37b1a753390e9be2b21e34e6193fe5ae1245f8d48d2e556c4a8d0cf4970c933b0c84b5a8a9469e52f34fba98f0d7c2d1e02ad8f5fd7921d82518dbac4f67fa2a3679a42e829b3bc3b85d36a0d82e92f70a37764e953ddd664c64abaa2a8fdc8184eacd95b'

describe('message keys', () => {
  it('shuffles the timestamp hex digits', () => {
    expect(encodeTimestamp(TIMESTAMP)).toBe('ace07863')
  })

  it('derives the per-message AES key from timestamp, local key and salt', () => {
    expect(messageKey(TIMESTAMP, LOCAL_KEY).toString('hex')).toBe('c810fc1c2ab5bbf4f7cca2c4c2bb92f5')
  })

  it('computes the same CRC-32 as binascii.crc32', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(3421780262)
  })
})

describe('RPC payloads', () => {
  it('derives the security endpoint from k', () => {
    expect(createSecurity(RRIOT).endpoint).toBe('87ItGWdb')
  })

  it('encodes get_status byte for byte as python-roborock does', () => {
    const payload = rpcRequestPayload({
      id: 44444,
      method: 'get_status',
      timestamp: TIMESTAMP,
      security: createSecurity(RRIOT, NONCE)
    })
    expect(payload.toString()).toBe(GET_STATUS_PAYLOAD)
  })

  it('decodes a status answer (python-roborock test_decode_rpc_response)', () => {
    const payload = Buffer.from(
      '{"t":1652547161,"dps":{"102":"{\\"id\\":20005,\\"result\\":[{\\"msg_ver\\":2,\\"state\\":8,\\"battery\\":100,\\"clean_time\\":1041,\\"clean_area\\":37080000,\\"error_code\\":0,\\"fan_power\\":103,\\"dnd_enabled\\":0}]}"}}'
    )
    const response = decodeRpcResponse(payload)!
    expect(response.id).toBe(20005)

    const status = readRoborockStatus(response.result, '2026-10-20T12:00:00.000Z')
    expect(status).toMatchObject({
      state: 8,
      stateLabel: 'Charging',
      onDock: true,
      active: false,
      battery: 100,
      fanPower: 103,
      fanLabel: 'Turbo',
      cleanMinutes: 17,
      cleanAreaM2: 37.1,
      errorLabel: ''
    })
    expect(status.fanOptions.map(option => option.value)).toEqual([101, 102, 103, 104])
  })

  it('ignores status pushes that are not RPC answers', () => {
    expect(decodeRpcResponse(Buffer.from('{"t":1652547161,"dps":{"121":8,"122":95}}'))).toBeNull()
  })
})

describe('frames', () => {
  const message = { seq: 123456, random: 54321, timestamp: TIMESTAMP, protocol: 101, payload: Buffer.from(GET_STATUS_PAYLOAD) }

  it('builds the same bytes as the reference layout', () => {
    expect(buildMessage(message, LOCAL_KEY).toString('hex')).toBe(FRAME_HEX)
  })

  it('parses its own frame back, including bytes in front of the version', () => {
    const framed = Buffer.concat([Buffer.from([0, 0, 0, 0xff]), Buffer.from(FRAME_HEX, 'hex')])
    const [parsed] = parseMessages(framed, LOCAL_KEY)
    expect(parsed).toMatchObject({ version: '1.0', seq: 123456, random: 54321, timestamp: TIMESTAMP, protocol: 101 })
    expect(parsed!.payload!.toString()).toBe(GET_STATUS_PAYLOAD)
  })

  it('refuses a frame whose checksum does not match', () => {
    const frame = Buffer.from(FRAME_HEX, 'hex')
    frame[frame.length - 1] ^= 0xff
    expect(() => parseMessages(frame, LOCAL_KEY)).toThrow('checksum')
  })
})

describe('credentials', () => {
  it('derives the MQTT login and topics', () => {
    const params = mqttParams(RRIOT)
    expect(params).toEqual({ url: 'mqtts://mqtt-us.roborock.com:8883', username: '19648f94', password: '234678ea854f199e' })
    expect(mqttTopics(RRIOT, params.username, 'duid1')).toEqual({
      publish: 'rr/m/i/user123/19648f94/duid1',
      subscribe: 'rr/m/o/user123/19648f94/duid1'
    })
  })

  it('signs device API requests with Hawk', () => {
    expect(hawkAuthorization(RRIOT, '/v3/user/homes/42', { timestamp: TIMESTAMP, nonce: 'abcdEFGH' })).toBe(
      'Hawk id="user123",s="pass123",ts="1737374400",nonce="abcdEFGH",mac="uTx36VMejXtSlw6UJZNP3PdvR31/Opy0gEtEZLmQp/A="'
    )
    expect(
      hawkAuthorization(RRIOT, '/ota/firmware/x/updatev2', { params: { z: 1, lang: 'en' }, timestamp: TIMESTAMP, nonce: 'abcdEFGH' })
    ).toBe('Hawk id="user123",s="pass123",ts="1737374400",nonce="abcdEFGH",mac="X1UlNMo3AmBwGEbJoDfU0cNEk25QYkjPTzwva9nsvj8="')
  })

  it('derives header_clientid from email and client identifier', () => {
    expect(headerClientId('user@domain.com', 'device-ident-123')).toBe('rMcriokDPpW3cb0e549oyA==')
  })
})

describe('reading the vacuum', () => {
  it('uses percentage fan steps on older models', () => {
    expect(roborockFanOptions(60).map(option => option.value)).toEqual([38, 60, 75, 100])
    expect(readRoborockStatus([{ state: 5, fan_power: 60, error_code: 0 }], 'now')).toMatchObject({
      stateLabel: 'Cleaning',
      active: true,
      fanLabel: 'Balanced'
    })
  })

  it('names an error', () => {
    expect(readRoborockStatus([{ state: 12, error_code: 8 }], 'now')).toMatchObject({ stateLabel: 'Error', errorLabel: 'Robot trapped' })
  })

  it('turns consumable wear into percent left', () => {
    expect(
      readRoborockConsumables([{ main_brush_work_time: 540_000, side_brush_work_time: 720_000, filter_work_time: 0 }])
    ).toEqual({ mainBrush: 50, sideBrush: 0, filter: 100, sensors: null })
  })

  it('reads both shapes of the cleaning summary', () => {
    expect(readRoborockSummary([36_000, 120_000_000, 14, [1, 2]])).toEqual({ hours: 10, areaM2: 120, count: 14 })
    expect(readRoborockSummary({ clean_time: 5_400, clean_area: 2_500_000, clean_count: 3 })).toEqual({
      hours: 1.5,
      areaM2: 3,
      count: 3
    })
  })
})
