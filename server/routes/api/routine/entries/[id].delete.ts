import { useRoutineRepository } from '~~/server/utils/routine-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const templateId = getRouterParam(event, 'id') || ''
  // Archive rather than delete so recorded history keeps reading correctly.
  const record = await useRoutineRepository().archiveTemplate(user.id, templateId)

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Routine item not found.' })
  }

  await usePlannerRepository().createAuditEvent(user.id, 'archive', 'routine-item', record.id, {
    description: record.description
  })
  return { ok: true }
})
