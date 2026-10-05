import { z } from 'zod'
import { useRoutineRepository } from '~~/server/utils/routine-repository'

const moveSchema = z.object({
  direction: z.enum(['up', 'down'])
})

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const templateId = getRouterParam(event, 'id') || ''
  const body = moveSchema.parse(await readBody(event))
  const templates = await useRoutineRepository().moveTemplate(user.id, templateId, body.direction)

  if (!templates) {
    throw createError({ statusCode: 404, statusMessage: 'Routine item not found.' })
  }

  return { templates }
})
