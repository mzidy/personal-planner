import { useHabitRepository } from '~~/server/utils/habit-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return { plans: await useHabitRepository().listPlans(user.id) }
})
