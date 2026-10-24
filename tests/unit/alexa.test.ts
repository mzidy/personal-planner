import { X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { rootCertificates } from 'node:tls'
import { describe, expect, it } from 'vitest'
import {
  checkCertChain,
  isFreshTimestamp,
  isValidCertUrl,
  splitPemChain,
  verifyBodySignature
} from '../../server/utils/alexa-verify'
import { confirmation, linkCodeFrom, speak, todaySpeech, weightFrom } from '../../server/utils/alexa-speech'
import { vacuumStatusSpeech } from '../../server/utils/alexa-vacuum'
import { VOICE_COMMANDS } from '../../shared/utils/voice-commands'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/alexa/${name}`, import.meta.url), 'utf8')
const ROOT = new X509Certificate(fixture('root.pem'))
const OTHER_ROOT = new X509Certificate(fixture('other-root.pem'))
const NOW = new Date('2027-01-01T00:00:00Z')

describe('certificate URL', () => {
  it("accepts only Amazon's bucket, as the Alexa docs list it", () => {
    for (const url of [
      'https://s3.amazonaws.com/echo.api/echo-api-cert.pem',
      'https://s3.amazonaws.com:443/echo.api/echo-api-cert.pem',
      'https://s3.amazonaws.com/echo.api/../echo.api/echo-api-cert.pem',
      'HTTPS://S3.AMAZONAWS.COM/echo.api/echo-api-cert.pem'
    ]) {
      expect(isValidCertUrl(url), url).toBe(true)
    }
    for (const url of [
      'http://s3.amazonaws.com/echo.api/echo-api-cert.pem',
      'https://notamazon.com/echo.api/echo-api-cert.pem',
      'https://s3.amazonaws.com/EcHo.aPi/echo-api-cert.pem',
      'https://s3.amazonaws.com/invalid.path/echo-api-cert.pem',
      'https://s3.amazonaws.com:563/echo.api/echo-api-cert.pem',
      '',
      undefined
    ]) {
      expect(isValidCertUrl(url), String(url)).toBe(false)
    }
  })
})

describe('certificate chain', () => {
  const chain = splitPemChain(fixture('chain.pem'))

  it('returns the signing certificate of a chain that reaches a trusted root', () => {
    expect(chain).toHaveLength(2)
    const leaf = checkCertChain(chain, NOW, [ROOT])
    expect(leaf.subject).toContain('echo-api.amazon.com')
  })

  it('refuses a chain for another host, an untrusted root, a broken order and an expired certificate', () => {
    expect(() => checkCertChain(splitPemChain(fixture('wrong-host-chain.pem')), NOW, [ROOT])).toThrow('not for echo-api.amazon.com')
    expect(() => checkCertChain(chain, NOW, [OTHER_ROOT])).toThrow('trusted root')
    expect(() => checkCertChain([...chain].reverse(), NOW, [ROOT])).toThrow()
    expect(() => checkCertChain(chain, new Date('2040-01-01T00:00:00Z'), [ROOT])).toThrow('not valid now')
    expect(() => checkCertChain([], NOW, [ROOT])).toThrow('empty')
  })

  it("anchors Amazon's real chain in Node's own root list, past its cross-signed roots", () => {
    // echo-api-cert-12.pem as Amazon serves it: leaf, Amazon RSA 2048 M01, Amazon Root CA 1 cross-signed
    // by Starfield, and Starfield Services Root G2 cross-signed by Starfield Class 2. Its leaf ran
    // until December 2023, so the check runs as of mid-2023.
    const amazon = splitPemChain(fixture('amazon-echo-api-cert-12.pem'))
    const nodeRoots = rootCertificates.map(pem => new X509Certificate(pem))
    expect(amazon).toHaveLength(4)
    expect(checkCertChain(amazon, new Date('2023-06-01T00:00:00Z'), nodeRoots).subject).toContain('echo-api.amazon.com')
    expect(() => checkCertChain(amazon, new Date('2024-06-01T00:00:00Z'), nodeRoots)).toThrow('not valid now')
  })

  it('checks the signature against the exact body', () => {
    const leaf = checkCertChain(chain, NOW, [ROOT])
    const body = fixture('body.json')
    const signature = fixture('body.sig')
    expect(verifyBodySignature(leaf, signature, body)).toBe(true)
    expect(verifyBodySignature(leaf, signature, body.replace('LaunchRequest', 'IntentRequest'))).toBe(false)
    expect(verifyBodySignature(leaf, undefined, body)).toBe(false)
    expect(verifyBodySignature(leaf, 'not-base64!', body)).toBe(false)
  })

  it('accepts a request only within 150 seconds of its timestamp', () => {
    expect(isFreshTimestamp('2026-12-31T23:58:00Z', NOW)).toBe(true)
    expect(isFreshTimestamp('2026-12-31T23:57:00Z', NOW)).toBe(false)
    expect(isFreshTimestamp(undefined, NOW)).toBe(false)
  })
})

describe('what Alexa says', () => {
  const build = (key: string, text: string) => VOICE_COMMANDS.find(command => command.key === key)!.build(text, text)!

  it('confirms each kind of command in plain words', () => {
    expect(confirmation('shopping', build('shopping', 'milk'))).toBe('Added Milk to your shopping list.')
    expect(confirmation('task', build('task', 'call the plumber'))).toBe('Added the task Call the plumber.')
    expect(confirmation('task', build('task', 'send the invoice high priority'))).toBe('Added the task Send the invoice, high priority.')
    expect(confirmation('weight', build('weight', weightFrom('84', '2')!))).toBe('Logged 84.2 kilos for this week.')
    expect(confirmation('routine', build('routine', 'twenty minutes of reading'))).toBe('Added Twenty minutes of reading to your daily routine.')
  })

  it('reads out the day, most urgent tasks first', () => {
    expect(
      todaySpeech({
        blocks: 2,
        routineDone: 1,
        routineTotal: 4,
        tasks: [
          { title: 'Plan the trip', urgency: 'low' },
          { title: 'Send the invoice', urgency: 'critical' },
          { title: 'Book the dentist', urgency: 'medium' },
          { title: 'Call the bank', urgency: 'high' }
        ]
      })
    ).toBe(
      'Today you have 2 scheduled blocks, 1 of 4 routine items done and 4 open tasks. The most urgent are Send the invoice, Call the bank and Book the dentist.'
    )
    expect(todaySpeech({ blocks: 0, routineDone: 0, routineTotal: 0, tasks: [] })).toBe('Today you have nothing on the calendar and no open tasks.')
  })

  it('reads a link code and a weight from the slots', () => {
    expect(linkCodeFrom('482913')).toBe('482913')
    expect(linkCodeFrom('482 913')).toBe('482913')
    expect(linkCodeFrom('4829')).toBeNull()
    expect(weightFrom('84', undefined)).toBe('84')
    expect(weightFrom('84', '25')).toBe('84.25')
    expect(weightFrom(undefined, '2')).toBeNull()
  })

  it("says what the vacuum is doing, and any error", () => {
    const status = { state: 8, stateLabel: 'Charging', battery: 87, errorCode: 0, errorLabel: '' } as Parameters<typeof vacuumStatusSpeech>[0]
    expect(vacuumStatusSpeech(status)).toBe('The vacuum is charging, battery 87 percent.')
    expect(vacuumStatusSpeech({ ...status, stateLabel: 'Error', battery: null, errorCode: 2, errorLabel: 'Bumper stuck' })).toBe(
      'The vacuum has a problem: Bumper stuck.'
    )
  })

  it('ends the session unless it asks a question', () => {
    expect(speak('Okay.').response.shouldEndSession).toBe(true)
    expect(speak('What next?', { reprompt: 'Say it again?' }).response).toMatchObject({ shouldEndSession: false, reprompt: { outputSpeech: { text: 'Say it again?' } } })
  })
})
