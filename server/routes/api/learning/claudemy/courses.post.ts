import { claudemyCourseSchema } from '~~/shared/schemas/claudemy'
import { useClaudemyRepository } from '~~/server/utils/claudemy-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'claudemy-create', 10, 60_000)
  const body = claudemyCourseSchema.parse(await readBody(event))
  const record = await useClaudemyRepository().createCourse(user.id, body)
  await usePlannerRepository().createAuditEvent(user.id, 'create', 'claudemy-course', record.id, { topic: record.topic })
  return record
})
