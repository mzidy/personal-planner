export default defineEventHandler(async () => {
  return usePlannerRepository().getBootstrap()
})
