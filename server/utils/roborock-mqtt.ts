import { randomBytes, randomInt } from 'node:crypto'
import { connectAsync } from 'mqtt'
import {
  RPC_REQUEST,
  type RoborockRriot,
  buildMessage,
  createSecurity,
  decodeRpcResponse,
  mqttParams,
  mqttTopics,
  parseMessages,
  rpcRequestPayload
} from '~~/server/utils/roborock-protocol'

/**
 * Sends V1 commands to a vacuum through Roborock's cloud MQTT broker and
 * waits for the answers. A serverless function cannot hold a connection
 * open between requests, so each call connects, subscribes to the device's
 * answer topic, publishes, and disconnects again: a second or two.
 */

export class RoborockDeviceError extends Error {
  constructor(
    message: string,
    /** The robot answered but refused, as opposed to not answering at all. */
    readonly refused = false
  ) {
    super(message)
  }
}

export interface RoborockTarget {
  duid: string
  localKey: string
  rriot: RoborockRriot
}

export interface RoborockCall {
  method: string
  params?: unknown[] | Record<string, unknown> | number
}

function describeRefusal(error: unknown) {
  const detail = error as { code?: number; message?: string } | string
  if (typeof detail === 'object' && detail?.code === -10007) {
    return 'The vacuum cannot do that in its current state.'
  }
  const text = typeof detail === 'string' ? detail : detail?.message
  return `The vacuum refused: ${text || 'unknown reason'}.`
}

/**
 * Every call's own outcome. Only failing to reach the cloud at all throws;
 * one unsupported command does not sink the others.
 */
export async function callRoborockSettled(
  target: RoborockTarget,
  calls: RoborockCall[],
  timeoutMs = 10_000
): Promise<PromiseSettledResult<unknown>[]> {
  const params = mqttParams(target.rriot)
  const topics = mqttTopics(target.rriot, params.username, target.duid)
  const security = createSecurity(target.rriot)

  let client: Awaited<ReturnType<typeof connectAsync>>
  try {
    client = await connectAsync(
      params.url,
      {
        username: params.username,
        password: params.password,
        clientId: `serene_${randomBytes(6).toString('hex')}`,
        protocolVersion: 5,
        clean: true,
        connectTimeout: 8_000,
        reconnectPeriod: 0
      },
      false
    )
  } catch (error) {
    throw new RoborockDeviceError(`Could not connect to Roborock's cloud: ${(error as Error)?.message || 'unknown error'}.`)
  }

  const waiting = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  const timers = new Set<ReturnType<typeof setTimeout>>()

  client.on('message', (_topic, frame) => {
    let messages: ReturnType<typeof parseMessages>
    try {
      messages = parseMessages(frame, target.localKey)
    } catch {
      return
    }
    for (const message of messages) {
      const response = message.payload ? decodeRpcResponse(message.payload) : null
      const pending = response?.id !== null && response?.id !== undefined ? waiting.get(response.id) : undefined
      if (!response || !pending) {
        continue
      }
      waiting.delete(response.id!)
      if (response.error) {
        pending.reject(new RoborockDeviceError(describeRefusal(response.error), true))
      } else if (response.result === 'unknown_method') {
        pending.reject(new RoborockDeviceError('This vacuum does not support that command.', true))
      } else {
        pending.resolve(response.result)
      }
    }
  })

  try {
    await client.subscribeAsync(topics.subscribe)

    const used = new Set<number>()
    return await Promise.allSettled(
      calls.map(async entry => {
        let id = randomInt(10_000, 32_768)
        while (used.has(id)) {
          id = randomInt(10_000, 32_768)
        }
        used.add(id)

        const answer = new Promise<unknown>((resolve, reject) => {
          waiting.set(id, { resolve, reject })
          timers.add(
            setTimeout(() => {
              if (waiting.delete(id)) {
                reject(new RoborockDeviceError('The vacuum did not answer. It may be offline or out of Wi-Fi range.'))
              }
            }, timeoutMs)
          )
        })

        const timestamp = Math.floor(Date.now() / 1000)
        const frame = buildMessage(
          {
            seq: randomInt(100_000, 1_000_000),
            random: randomInt(10_000, 100_000),
            timestamp,
            protocol: RPC_REQUEST,
            payload: rpcRequestPayload({ id, method: entry.method, params: entry.params, timestamp, security })
          },
          target.localKey
        )
        await client.publishAsync(topics.publish, frame)
        return answer
      })
    )
  } finally {
    timers.forEach(clearTimeout)
    await client.endAsync(true).catch(() => undefined)
  }
}

/** All calls must succeed; the first failure is thrown. */
export async function callRoborock(target: RoborockTarget, calls: RoborockCall[], timeoutMs = 10_000) {
  const results = await callRoborockSettled(target, calls, timeoutMs)
  const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failed) {
    throw failed.reason
  }
  return results.map(result => (result as PromiseFulfilledResult<unknown>).value)
}
