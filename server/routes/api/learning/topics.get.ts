import { useLearningRepository } from '~~/server/utils/learning-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return useLearningRepository().listTopics(user.id)
})
