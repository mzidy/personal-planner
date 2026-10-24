import { useAlexaRepository } from '~~/server/utils/alexa-repository'

/** Disconnects every Alexa account linked to this user. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const repository = useAlexaRepository()
  await repository.unlinkAll(user.id)
  return { ...(await repository.status(user.id)), configured: Boolean(useRuntimeConfig().alexaSkillId) }
})
