import { useTickerRepository } from '~~/server/utils/ticker-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const reviewId = getRouterParam(event, 'id') || ''
  const record = await useTickerRepository().deleteReview(user.id, reviewId)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'ticker-review', record.id, {
    symbol: record.symbol
  })
  return { ok: true }
})
