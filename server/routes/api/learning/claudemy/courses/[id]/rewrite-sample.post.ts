import { claudemyFeedbackSchema } from '~~/shared/schemas/claudemy'
import { useClaudemyRepository } from '~~/server/utils/claudemy-repository'

/** Writes the sample lesson again with the learner's feedback, before anything else is made. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const courseId = getRouterParam(event, 'id') || ''
  const body = claudemyFeedbackSchema.parse(await readBody(event))
  const repository = useClaudemyRepository()

  const course = await repository.findCourse(user.id, courseId)
  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Course not found.' })
  }
  if (course.stage !== 'feedback') {
    throw createError({ statusCode: 409, statusMessage: 'The sample lesson is not waiting for feedback.' })
  }
  if (!body.feedback) {
    throw createError({ statusCode: 400, statusMessage: 'Say what to change in the sample lesson.' })
  }

  const [first] = await repository.listLessons(courseId)
  if (first) {
    await repository.updateLesson(first.id, { status: 'planned', attempts: 0, problems: [], heardAt: null })
  }
  await repository.updateCourse(courseId, { feedback: body.feedback, stage: 'sample', error: '' })
  return repository.view(user.id, courseId)
})
