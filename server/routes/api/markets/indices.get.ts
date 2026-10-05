import { useMarketsRepository } from '~~/server/utils/markets-repository'

export default defineEventHandler(async event => {
  // Public data, but there is no reason to run an open proxy for signed-out callers.
  await requireAppUser(event)
  return useMarketsRepository().getOverview()
})
