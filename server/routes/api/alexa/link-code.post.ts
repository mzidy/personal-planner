import { useAlexaRepository } from '~~/server/utils/alexa-repository'

/** A one-time code to say to Alexa ("ask serene planner to link 482913"). */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'alexa-link-code', 10, 60_000)
  return useAlexaRepository().createLinkCode(user.id)
})
