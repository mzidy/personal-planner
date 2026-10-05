import { useHabitRepository } from '~~/server/utils/habit-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const planId = getRouterParam(event, 'id') || ''
  const record = await useHabitRepository().deletePlan(user.id, planId)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Habit plan not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'habit-plan', record.id, {
    title: record.title
  })
  return { ok: true }
})
