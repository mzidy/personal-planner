import type { H3Event } from 'h3'
import type { PlannerUserRecord, Provider } from '~~/shared/types/planner'

export function toSessionUser(user: PlannerUserRecord) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarInitials: user.avatarInitials,
    emailVerified: user.emailVerified,
    role: user.role
  }
}

export async function establishSession(event: H3Event, user: PlannerUserRecord, provider: Provider) {
  await setUserSession(event, {
    user: toSessionUser(user),
    secure: {
      userId: user.id
    },
    loggedInAt: new Date().toISOString(),
    provider
  })
}
