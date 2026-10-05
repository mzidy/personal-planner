import { habitPlanSchema } from '~~/shared/schemas/habit'
import { useHabitRepository } from '~~/server/utils/habit-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = await readValidatedBody(event, habitPlanSchema.parse)
  const record = await useHabitRepository().createPlan(user.id, body)

  await usePlannerRepository().createAuditEvent(user.id, 'create', 'habit-plan', record.id, {
    title: record.title
  })
  return record
})
