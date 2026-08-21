import { useLearningRepository } from '~~/server/utils/learning-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const topicId = getRouterParam(event, 'id') || ''
  const repository = useLearningRepository()

  const topic = await repository.findTopic(user.id, topicId)
  if (!topic) {
    throw createError({ statusCode: 404, statusMessage: 'Topic not found.' })
  }

  const messages = await repository.listMessages(user.id, topicId)
  return { topic, messages }
})
