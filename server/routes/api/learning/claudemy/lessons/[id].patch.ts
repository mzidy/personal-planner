import { claudemyProgressSchema } from '~~/shared/schemas/claudemy'
import { useClaudemyRepository } from '~~/server/utils/claudemy-repository'

/** Effort, not streaks: a lesson heard, a thing tried, a rule kept. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = claudemyProgressSchema.parse(await readBody(event))
  const repository = useClaudemyRepository()

  const lesson = await repository.findLesson(user.id, getRouterParam(event, 'id') || '')
  if (!lesson) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found.' })
  }

  const now = new Date().toISOString()
  const patch: Parameters<typeof repository.updateLesson>[1] = {}
  if (body.heard !== undefined) {
    patch.heardAt = body.heard ? lesson.heardAt || now : null
  }
  if (body.tried !== undefined) {
    patch.triedAt = body.tried ? lesson.triedAt || now : null
  }
  if (body.ruleKept !== undefined) {
    patch.ruleKept = body.ruleKept
  }
  await repository.updateLesson(lesson.id, patch)
  return repository.findLesson(user.id, lesson.id)
})
