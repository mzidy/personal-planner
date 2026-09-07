import { useRoutineRepository } from '~~/server/utils/routine-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const entryId = getRouterParam(event, 'id') || ''
  const record = await useRoutineRepository().deleteEntry(user.id, entryId)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Routine entry not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'routine-entry', record.id, {
    entryDate: record.entryDate
  })
  return { ok: true }
})
