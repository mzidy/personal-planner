import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Encrypts credentials kept in the database (the Roborock session, device
 * keys) with AES-256-GCM, keyed from the session password the app already
 * requires (NUXT_SESSION_PASSWORD). A copy of the database alone is then not
 * enough to drive someone's vacuum.
 *
 * Changing the session password makes old values unreadable; openSecret then
 * returns null and the account has to be connected again.
 */

const PREFIX = 'v1.'

function key() {
  const config = useRuntimeConfig() as { session?: { password?: string } }
  const password = config.session?.password || process.env.NUXT_SESSION_PASSWORD
  if (!password) {
    throw createError({ statusCode: 503, statusMessage: 'NUXT_SESSION_PASSWORD is not set, so credentials cannot be stored.' })
  }
  return createHash('sha256').update(`serene-executive:smart-home:${password}`).digest()
}

export function sealSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

export function openSecret(sealed: string | null): string | null {
  if (!sealed?.startsWith(PREFIX)) {
    return null
  }
  try {
    const raw = Buffer.from(sealed.slice(PREFIX.length), 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
