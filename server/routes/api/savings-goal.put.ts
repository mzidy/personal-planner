import { savingsGoalSchema } from '~~/shared/schemas/savings'
import { useSavingsRepository } from '~~/server/utils/savings-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const parsed = savingsGoalSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Check the goal.' })
  }
  return { goal: await useSavingsRepository().save(user.id, parsed.data) }
})
