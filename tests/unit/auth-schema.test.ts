import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema, resetPasswordSchema } from '../../shared/schemas/auth'

describe('auth schemas', () => {
  it('accepts valid registration payloads', () => {
    const result = registerSchema.safeParse({
      displayName: 'Julian Sterling',
      email: 'julian@example.com',
      password: 'ConciergeDemo123!'
    })

    expect(result.success).toBe(true)
  })

  it('rejects invalid login payloads', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: ''
    })

    expect(result.success).toBe(false)
  })

  it('requires a reset token and a long enough password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'short',
      password: 'tiny'
    })

    expect(result.success).toBe(false)
  })
})
