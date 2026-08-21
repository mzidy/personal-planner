import { useShoppingRepository } from '~~/server/utils/shopping-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const itemId = getRouterParam(event, 'id') || ''
  const record = await useShoppingRepository().deleteItem(user.id, itemId)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Shopping item not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'shopping-item', record.id, { name: record.name })
  return { ok: true }
})
