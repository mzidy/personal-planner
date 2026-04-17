import { z } from 'zod'

export const registerSchema = z.object({
  displayName: z.string().min(2).max(80),
  email: z.email(),
  password: z.string().min(10).max(128)
})

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128)
})

export const requestPasswordResetSchema = z.object({
  email: z.email()
})

export const resetPasswordSchema = z.object({
  token: z.string().min(12),
  password: z.string().min(10).max(128)
})

export const verifyEmailSchema = z.object({
  token: z.string().min(12)
})
