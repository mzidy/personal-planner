import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema, resetPasswordSchema } from '../../shared/schemas/auth'

describe('auth schemas', () => {
  it('accepts valid registration payloads', () => {
    const result = registerSchema.safeParse({
      displayName: 'Julian Sterling',
      email: ' Julian@Example.com ',
      password: 'ConciergeDemo123!',
      gender: 'male',
      birthDate: '1990-05-14'
    })

    expect(result.success).toBe(true)
    expect(result.data?.email).toBe('julian@example.com')
  })

  it('asks for a gender and a plausible date of birth when registering', () => {
    const base = { displayName: 'Julian Sterling', email: 'julian@example.com', password: 'ConciergeDemo123!' }
    expect(registerSchema.safeParse({ ...base, birthDate: '1990-05-14' }).error?.issues[0]?.message).toBe(
      'Choose a gender, or "Prefer not to say".'
    )
    expect(registerSchema.safeParse({ ...base, gender: 'robot', birthDate: '1990-05-14' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, gender: 'unspecified', birthDate: '1990-02-30' }).error?.issues[0]?.message).toBe(
      'Enter the date of birth as a real date.'
    )
    expect(registerSchema.safeParse({ ...base, gender: 'female', birthDate: '2099-01-01' }).error?.issues[0]?.message).toBe(
      'The date of birth cannot be in the future.'
    )
    expect(registerSchema.safeParse({ ...base, gender: 'other' }).success).toBe(false)
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
