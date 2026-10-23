import { firstName } from '~~/shared/utils/home'
import { themeForProfile } from '~~/shared/utils/themes'
import { useStatsRepository } from '~~/server/utils/stats-repository'

/** The theme the profile calls for (gender and age), and the name to greet. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const profile = await useStatsRepository().getProfile(user.id)
  return {
    theme: themeForProfile(profile?.gender, profile?.birthDate),
    firstName: firstName(user.displayName)
  }
})
