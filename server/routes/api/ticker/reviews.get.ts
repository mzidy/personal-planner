import { useTickerRepository } from '~~/server/utils/ticker-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return { history: await useTickerRepository().listReviews(user.id) }
})
