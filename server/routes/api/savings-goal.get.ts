import { useSavingsRepository } from '~~/server/utils/savings-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return { goal: await useSavingsRepository().find(user.id) }
})
