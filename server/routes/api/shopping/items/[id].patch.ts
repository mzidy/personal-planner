import { shoppingItemPatchSchema } from '~~/shared/schemas/shopping'
import { useShoppingRepository } from '~~/server/utils/shopping-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const itemId = getRouterParam(event, 'id') || ''
  const body = shoppingItemPatchSchema.parse(await readBody(event))
  const record = await useShoppingRepository().updateItem(user.id, itemId, body)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Shopping item not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'update', 'shopping-item', record.id, {
    name: record.name,
    bought: record.bought
  })
  return record
})
