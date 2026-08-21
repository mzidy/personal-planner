import { z } from 'zod'

export const investmentKindSchema = z.enum(['etf', 'stock', 'option'])
export const optionTypeSchema = z.enum(['call', 'put'])

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')

export const investmentPositionSchema = z
  .object({
    kind: investmentKindSchema,
    symbol: z.string().min(1).max(24),
    name: z.string().max(120).optional(),
    quantity: z.number().gt(0).max(10_000_000),
    unitCost: z.number().min(0).max(10_000_000),
    currentPrice: z.number().min(0).max(10_000_000).nullable().optional(),
    currency: z.string().min(3).max(3).optional(),
    notes: z.string().max(400).optional(),
    openedAt: isoDate.nullable().optional(),
    optionType: optionTypeSchema.nullable().optional(),
    strike: z.number().min(0).max(10_000_000).nullable().optional(),
    expiry: isoDate.nullable().optional(),
    contractSize: z.number().gt(0).max(10_000).nullable().optional()
  })
  .refine(value => value.kind !== 'option' || Boolean(value.optionType), {
    message: 'Options need a call/put type.',
    path: ['optionType']
  })

export const investmentPositionPatchSchema = z.object({
  symbol: z.string().min(1).max(24).optional(),
  name: z.string().max(120).optional(),
  quantity: z.number().gt(0).max(10_000_000).optional(),
  unitCost: z.number().min(0).max(10_000_000).optional(),
  currentPrice: z.number().min(0).max(10_000_000).nullable().optional(),
  notes: z.string().max(400).optional(),
  optionType: optionTypeSchema.nullable().optional(),
  strike: z.number().min(0).max(10_000_000).nullable().optional(),
  expiry: isoDate.nullable().optional(),
  contractSize: z.number().gt(0).max(10_000).nullable().optional()
})

export type InvestmentPositionInput = z.infer<typeof investmentPositionSchema>
export type InvestmentPositionPatch = z.infer<typeof investmentPositionPatchSchema>
