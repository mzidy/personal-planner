import { createHash, randomBytes } from 'node:crypto'

export function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function createOpaqueToken() {
  return randomBytes(24).toString('hex')
}
