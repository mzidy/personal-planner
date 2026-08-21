import { learningTopicSchema } from '~~/shared/schemas/learning'
import { useLearningRepository } from '~~/server/utils/learning-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = learningTopicSchema.parse(await readBody(event))
  const repository = useLearningRepository()
  const record = await repository.createTopic(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'learning-topic', record.id, { title: record.title })
  return record
})
