export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return usePlannerRepository().getDashboard(user.id)
})
