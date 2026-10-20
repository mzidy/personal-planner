import { z } from 'zod'

export const roborockCodeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200)
})

export const roborockLoginSchema = z.object({
  code: z.string().trim().regex(/^\d{4,8}$/, 'The code from the email is 4 to 8 digits.')
})

export const vacuumCommandSchema = z.object({
  action: z.enum(['start', 'pause', 'stop', 'dock', 'find', 'fan']),
  value: z.number().int().optional()
})
