import { z } from 'zod'

export const tickerReviewSchema = z.object({
  // Tickers are letters with optional . or - suffixes (BRK.B, RDS-A).
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z][A-Za-z0-9.-]*$/, 'Use a ticker symbol such as AAPL or BRK.B.')
})

export type TickerReviewInput = z.infer<typeof tickerReviewSchema>
