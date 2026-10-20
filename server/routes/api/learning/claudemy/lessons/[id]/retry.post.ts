import { useClaudemyRepository } from '~~/server/utils/claudemy-repository'

/** A lesson that failed the checker three times stays reported until the learner asks for another go. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const repository = useClaudemyRepository()

  const lesson = await repository.findLesson(user.id, getRouterParam(event, 'id') || '')
  if (!lesson) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found.' })
  }
  if (lesson.status !== 'failed') {
    throw createError({ statusCode: 409, statusMessage: 'Only a lesson that failed the checker can be retried.' })
  }

  const course = await repository.findCourse(user.id, lesson.courseId)
  await repository.updateLesson(lesson.id, { status: 'planned', attempts: 0 })
  if (course?.stage === 'done') {
    await repository.updateCourse(course.id, { stage: 'writing', error: '' })
  }
  return repository.view(user.id, lesson.courseId)
})
