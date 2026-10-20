import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RPC_RESPONSE, buildMessage, parseMessages } from '../../server/utils/roborock-protocol'

/**
 * A stand-in for Roborock's broker and the vacuum behind it: it decrypts
 * each published request, reads its id and method, and answers on the
 * subscribed topic the way a V1 vacuum does. That exercises connecting,
 * subscribing, publishing and matching answers to requests without a robot.
 */
const LOCAL_KEY = 'key123key123key1'
const RRIOT = {
  u: 'user123',
  s: 'pass123',
  h: 'unknown123',
  k: 'qiCNieZa',
  r: { a: 'https://api-us.roborock.com', m: 'ssl://mqtt-us.roborock.com:8883' }
}

type Answer = (method: string) => { result?: unknown; error?: unknown } | null

let answer: Answer = () => ({ result: ['ok'] })
const connections: { url: string; options: Record<string, unknown>; published: string[]; subscribed: string[]; ended: boolean }[] = []

vi.mock('mqtt', () => ({
  connectAsync: async (url: string, options: Record<string, unknown>) => {
    const client = new EventEmitter() as EventEmitter & Record<string, unknown>
    const record = { url, options, published: [] as string[], subscribed: [] as string[], ended: false }
    connections.push(record)
    let subscribedTopic = ''
    client.subscribeAsync = async (topic: string) => {
      subscribedTopic = topic
      record.subscribed.push(topic)
      return []
    }
    client.publishAsync = async (topic: string, frame: Buffer) => {
      record.published.push(topic)
      const [request] = parseMessages(frame, LOCAL_KEY)
      const inner = JSON.parse(JSON.parse(request!.payload!.toString()).dps['101'])
      const reply = answer(inner.method)
      if (!reply) {
        return undefined
      }
      const timestamp = Math.floor(Date.now() / 1000)
      const payload = Buffer.from(JSON.stringify({ t: timestamp, dps: { [RPC_RESPONSE]: JSON.stringify({ id: inner.id, ...reply }) } }))
      // A status push first, which has to be ignored, then the answer, prefixed like real broker frames.
      const push = buildMessage({ seq: 1, random: 2, timestamp, protocol: 102, payload: Buffer.from('{"t":1,"dps":{"121":8}}') }, LOCAL_KEY)
      const reply2 = buildMessage({ seq: 3, random: 4, timestamp, protocol: 102, payload }, LOCAL_KEY)
      setTimeout(() => {
        client.emit('message', subscribedTopic, push)
        client.emit('message', subscribedTopic, Buffer.concat([Buffer.alloc(4), reply2]))
      }, 5)
      return undefined
    }
    client.endAsync = async () => {
      record.ended = true
    }
    return client
  }
}))

const { RoborockDeviceError, callRoborock, callRoborockSettled } = await import('../../server/utils/roborock-mqtt')
const target = { duid: 'duid1', localKey: LOCAL_KEY, rriot: RRIOT }

beforeEach(() => {
  connections.length = 0
  answer = () => ({ result: ['ok'] })
})

describe('callRoborock', () => {
  it('logs in with the derived credentials and uses the device topics', async () => {
    await callRoborock(target, [{ method: 'app_start' }])
    const [connection] = connections
    expect(connection!.url).toBe('mqtts://mqtt-us.roborock.com:8883')
    expect(connection!.options).toMatchObject({ username: '19648f94', password: '234678ea854f199e', protocolVersion: 5 })
    expect(connection!.subscribed).toEqual(['rr/m/o/user123/19648f94/duid1'])
    expect(connection!.published).toEqual(['rr/m/i/user123/19648f94/duid1'])
    expect(connection!.ended).toBe(true)
  })

  it('matches each answer to its request', async () => {
    answer = method => ({ result: method === 'get_status' ? [{ state: 8, battery: 91 }] : { main_brush_work_time: 10 } })
    const [status, consumables] = await callRoborock(target, [{ method: 'get_status' }, { method: 'get_consumable' }])
    expect(status).toEqual([{ state: 8, battery: 91 }])
    expect(consumables).toEqual({ main_brush_work_time: 10 })
  })

  it('reports a refusal from the robot as refused', async () => {
    answer = () => ({ error: { code: -10007, message: 'invalid status' } })
    const error = await callRoborock(target, [{ method: 'app_start' }]).catch(caught => caught)
    expect(error).toBeInstanceOf(RoborockDeviceError)
    expect(error.refused).toBe(true)
    expect(error.message).toBe('The vacuum cannot do that in its current state.')
  })

  it('gives up on a robot that does not answer, and still disconnects', async () => {
    answer = () => null
    const error = await callRoborock(target, [{ method: 'get_status' }], 50).catch(caught => caught)
    expect(error).toBeInstanceOf(RoborockDeviceError)
    expect(error.refused).toBe(false)
    expect(connections[0]!.ended).toBe(true)
  })

  it('keeps the other answers when one command is unsupported', async () => {
    answer = method => (method === 'get_clean_summary' ? { result: 'unknown_method' } : { result: [{ state: 3 }] })
    const results = await callRoborockSettled(target, [{ method: 'get_status' }, { method: 'get_clean_summary' }])
    expect(results[0]).toEqual({ status: 'fulfilled', value: [{ state: 3 }] })
    expect(results[1]!.status).toBe('rejected')
  })
})
