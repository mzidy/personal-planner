import { shoppingItemSchema } from '~~/shared/schemas/shopping'
import { useShoppingRepository } from '~~/server/utils/shopping-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = shoppingItemSchema.parse(await readBody(event))
  const record = await useShoppingRepository().createItem(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'shopping-item', record.id, {
    name: record.name,
    horizon: record.horizon
  })
  return record
})
