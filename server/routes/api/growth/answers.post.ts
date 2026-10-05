import { growthAnswerSchema } from '~~/shared/schemas/growth'
import { useGrowthRepository } from '~~/server/utils/growth-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const body = await readValidatedBody(event, growthAnswerSchema.parse)
  const record = await useGrowthRepository().saveAnswer(user.id, body)

  await usePlannerRepository().createAuditEvent(
    user.id,
    record ? 'update' : 'delete',
    'growth-answer',
    record?.id || body.stepKey,
    { stepKey: body.stepKey }
  )
  return useGrowthRepository().getOverview(user.id)
})
