import { X509Certificate, createVerify } from 'node:crypto'
import { rootCertificates } from 'node:tls'

/**
 * Proof that a request to /api/alexa really comes from Alexa, as Amazon
 * requires of any skill endpoint that is not on Lambda:
 * https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-a-web-service.html
 *
 * The request carries the URL of Amazon's signing certificate and an RSA
 * SHA-256 signature of the raw body. The URL must point at Amazon's bucket,
 * the certificate must be current, name echo-api.amazon.com and chain to a
 * trusted root, the signature must match the body, and the request must be
 * no older than 150 seconds.
 */

export class AlexaVerificationError extends Error {}

export const ALEXA_SIGNING_HOST = 'echo-api.amazon.com'
export const ALEXA_MAX_AGE_MS = 150_000

/** https://s3.amazonaws.com/echo.api/… only; the path is compared after "../" is resolved. */
export function isValidCertUrl(raw: string | undefined | null) {
  if (!raw) {
    return false
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === 's3.amazonaws.com' &&
    (url.port === '' || url.port === '443') &&
    url.pathname.startsWith('/echo.api/')
  )
}

export function splitPemChain(pem: string) {
  return pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || []
}

/** A trusted root itself, perhaps served cross-signed: same subject, same key. */
function isRoot(cert: X509Certificate, root: X509Certificate) {
  return (
    cert.subject === root.subject &&
    cert.publicKey.export({ type: 'spki', format: 'der' }).equals(root.publicKey.export({ type: 'spki', format: 'der' }))
  )
}

/**
 * Checks the chain and returns the signing certificate. `roots` are the
 * trust anchors (Node's bundled CA list in production).
 *
 * The chain is walked up from the leaf and stops at the first certificate a
 * trusted root vouches for. Amazon's chain carries cross-signed roots above
 * that point (Amazon Root CA 1 under Starfield); whether those are current, or
 * in Node's list at all, does not matter once the chain is anchored.
 */
export function checkCertChain(pems: string[], now: Date, roots: X509Certificate[]) {
  if (!pems.length) {
    throw new AlexaVerificationError('The certificate chain is empty.')
  }
  const certs = pems.map(pem => new X509Certificate(pem))
  const leaf = certs[0]!
  if (!leaf.checkHost(ALEXA_SIGNING_HOST, { subject: 'never' })) {
    throw new AlexaVerificationError(`The signing certificate is not for ${ALEXA_SIGNING_HOST}.`)
  }
  for (const [index, cert] of certs.entries()) {
    if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) {
      throw new AlexaVerificationError('A certificate in the chain is not valid now.')
    }
    if (roots.some(root => isRoot(cert, root) || (cert.checkIssued(root) && cert.verify(root.publicKey)))) {
      return leaf
    }
    const issuer = certs[index + 1]
    if (!issuer) {
      break
    }
    if (!cert.checkIssued(issuer) || !cert.verify(issuer.publicKey)) {
      throw new AlexaVerificationError('The certificate chain is broken.')
    }
  }
  throw new AlexaVerificationError('The certificate chain does not end at a trusted root.')
}

export function verifyBodySignature(cert: X509Certificate, signature: string | undefined | null, body: string) {
  if (!signature) {
    return false
  }
  const verifier = createVerify('RSA-SHA256')
  verifier.update(body, 'utf8')
  try {
    return verifier.verify(cert.publicKey, signature, 'base64')
  } catch {
    return false
  }
}

export function isFreshTimestamp(timestamp: string | undefined, now: Date) {
  const sent = timestamp ? Date.parse(timestamp) : Number.NaN
  return Number.isFinite(sent) && Math.abs(now.getTime() - sent) <= ALEXA_MAX_AGE_MS
}

let trustedRoots: X509Certificate[] | null = null
const chainCache = new Map<string, { pems: string[]; expiresAt: number }>()

/** Downloads (and caches for a day) the PEM chain behind a certificate URL. */
async function fetchChain(url: string) {
  const cached = chainCache.get(url)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.pems
  }
  const text = await $fetch<string>(url, { responseType: 'text', timeout: 8000 }).catch(() => '')
  const pems = splitPemChain(text)
  if (pems.length) {
    chainCache.set(url, { pems, expiresAt: Date.now() + 24 * 3600_000 })
  }
  return pems
}

/** Verifies an incoming request's headers and raw body; throws when anything is off. */
export async function verifyAlexaRequest(input: { certUrl?: string; signature?: string; body: string; timestamp?: string }, now = new Date()) {
  if (!isValidCertUrl(input.certUrl)) {
    throw new AlexaVerificationError('The certificate URL is not Amazon’s.')
  }
  trustedRoots ??= rootCertificates.map(pem => new X509Certificate(pem))
  const leaf = checkCertChain(await fetchChain(input.certUrl!), now, trustedRoots)
  if (!verifyBodySignature(leaf, input.signature, input.body)) {
    throw new AlexaVerificationError('The signature does not match the request.')
  }
  if (!isFreshTimestamp(input.timestamp, now)) {
    throw new AlexaVerificationError('The request is too old.')
  }
}
