import { useAlexaRepository } from '~~/server/utils/alexa-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return { ...(await useAlexaRepository().status(user.id)), configured: Boolean(useRuntimeConfig().alexaSkillId) }
})
