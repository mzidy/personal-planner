import { habitPlanPatchSchema } from '~~/shared/schemas/habit'
import { useHabitRepository } from '~~/server/utils/habit-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const planId = getRouterParam(event, 'id') || ''
  const patch = await readValidatedBody(event, habitPlanPatchSchema.parse)
  const record = await useHabitRepository().updatePlan(user.id, planId, patch)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Habit plan not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'update', 'habit-plan', record.id, {
    title: record.title,
    status: record.status
  })
  return record
})
