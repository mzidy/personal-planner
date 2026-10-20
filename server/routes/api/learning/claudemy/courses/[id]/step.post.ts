import { useClaudemyRepository } from '~~/server/utils/claudemy-repository'
import { runClaudemyStep } from '~~/server/utils/claudemy-pipeline'

/**
 * Advances the course by one bounded step and returns where it now stands.
 * The page calls this in a loop; `busy` means another request holds the step.
 */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'claudemy-step', 60, 60_000)
  const courseId = getRouterParam(event, 'id') || ''

  const { busy } = await runClaudemyStep(user.id, courseId)
  const view = await useClaudemyRepository().view(user.id, courseId)
  return { busy, ...view! }
})
