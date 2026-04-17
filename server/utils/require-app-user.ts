import type { H3Event } from 'h3'
import type { PlannerUserRecord } from '~~/shared/types/planner'

export async function requireAppUser(event: H3Event): Promise<PlannerUserRecord> {
  const session = await requireUserSession(event)
  const repository = usePlannerRepository()
  const user = await repository.findUserById(session.user.id)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'The current session no longer maps to a user.'
    })
  }

  return user
}
