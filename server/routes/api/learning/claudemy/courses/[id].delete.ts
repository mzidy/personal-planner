import { useClaudemyRepository } from '~~/server/utils/claudemy-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const courseId = getRouterParam(event, 'id') || ''
  const repository = useClaudemyRepository()

  const course = await repository.findCourse(user.id, courseId)
  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Course not found.' })
  }

  await repository.deleteCourse(user.id, courseId)
  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'claudemy-course', courseId, { topic: course.topic })
  return { ok: true }
})
