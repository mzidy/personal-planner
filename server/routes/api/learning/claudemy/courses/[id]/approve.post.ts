import { claudemyFeedbackSchema } from '~~/shared/schemas/claudemy'
import { useClaudemyRepository } from '~~/server/utils/claudemy-repository'

/** The learner approves the sample lesson; their feedback shapes every lesson after it. */
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
    throw createError({ statusCode: 409, statusMessage: 'The sample lesson is not waiting for approval.' })
  }

  await repository.updateCourse(courseId, { feedback: body.feedback, stage: 'writing', error: '' })
  return repository.view(user.id, courseId)
})
