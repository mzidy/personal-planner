import { financeTransactionSchema } from '~~/shared/schemas/planner'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = financeTransactionSchema.parse(await readBody(event))
  const record = await usePlannerRepository().createFinanceTransaction(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'finance_transaction', record.id, {
    title: record.title,
    direction: record.direction
  })
  return record
})
