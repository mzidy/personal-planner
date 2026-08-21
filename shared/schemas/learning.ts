import { z } from 'zod'

export const learningTopicSchema = z.object({
  title: z.string().min(2).max(120),
  focus: z.string().max(400).default('')
})

export const learningChatSchema = z.object({
  message: z.string().min(1).max(4000)
})
