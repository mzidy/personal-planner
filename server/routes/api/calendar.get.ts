export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return usePlannerRepository().listTimeBlocks(user.id)
})
