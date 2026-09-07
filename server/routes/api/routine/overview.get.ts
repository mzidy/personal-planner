import { useRoutineRepository } from '~~/server/utils/routine-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return useRoutineRepository().getOverview(user.id)
})
