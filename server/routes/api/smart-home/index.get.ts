import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return useSmartHomeRepository().overview(user.id)
})
