import { z } from 'zod'
import { useRoutineRepository } from '~~/server/utils/routine-repository'

const moveSchema = z.object({
  direction: z.enum(['up', 'down'])
})

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const entryId = getRouterParam(event, 'id') || ''
  const body = moveSchema.parse(await readBody(event))
  const entries = await useRoutineRepository().moveEntry(user.id, entryId, body.direction)

  if (!entries) {
    throw createError({ statusCode: 404, statusMessage: 'Routine entry not found.' })
  }

  return { entries }
})
