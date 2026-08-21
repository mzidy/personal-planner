import { z } from 'zod'

export const shoppingHorizonSchema = z.enum(['short', 'medium', 'long'])

export const shoppingItemSchema = z.object({
  horizon: shoppingHorizonSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional(),
  price: z.number().min(0).max(10_000_000).nullable().optional()
})

export const shoppingItemPatchSchema = z.object({
  horizon: shoppingHorizonSchema.optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(400).optional(),
  price: z.number().min(0).max(10_000_000).nullable().optional(),
  bought: z.boolean().optional()
})

export type ShoppingItemInput = z.infer<typeof shoppingItemSchema>
export type ShoppingItemPatch = z.infer<typeof shoppingItemPatchSchema>
