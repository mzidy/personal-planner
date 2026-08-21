import { useLearningRepository } from '~~/server/utils/learning-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const topicId = getRouterParam(event, 'id') || ''
  const repository = useLearningRepository()

  const topic = await repository.findTopic(user.id, topicId)
  if (!topic) {
    throw createError({ statusCode: 404, statusMessage: 'Topic not found.' })
  }

  await repository.deleteTopic(user.id, topicId)
  await usePlannerRepository().createAuditEvent(user.id, 'delete', 'learning-topic', topicId, { title: topic.title })
  return { ok: true }
})
