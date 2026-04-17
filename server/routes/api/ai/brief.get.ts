export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return usePlannerRepository().getAiBrief(user.id)
})
