import { z } from 'zod'
import { GENDERS, birthDateProblem } from '../utils/profile'

export const genderSchema = z.enum(GENDERS, 'Choose a gender, or "Prefer not to say".')

export const birthDateSchema = z.string().superRefine((value, ctx) => {
  const problem = birthDateProblem(value)
  if (problem) {
    ctx.addIssue({ code: 'custom', message: problem })
  }
})

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Use at least 2 characters for the name.').max(80, 'Keep the name under 80 characters.'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
  password: z.string().min(10, 'Use at least 10 characters for the password.').max(128, 'Keep the password under 128 characters.'),
  gender: genderSchema,
  birthDate: birthDateSchema
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
