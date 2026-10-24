import { AlexaVerificationError, verifyAlexaRequest } from '~~/server/utils/alexa-verify'
import { type AlexaEnvelope, applicationIdOf, handleAlexaRequest } from '~~/server/utils/alexa-skill'
import { speak } from '~~/server/utils/alexa-speech'

/**
 * The endpoint of the "Serene planner" Alexa skill. No session: each request
 * is proven to come from Alexa by its signature, then must belong to our
 * skill, and acts for the user its Alexa account was linked to.
 */
export default defineEventHandler(async event => {
  const body = (await readRawBody(event, 'utf8')) || ''
  let envelope: AlexaEnvelope
  try {
    envelope = JSON.parse(body) as AlexaEnvelope
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Not an Alexa request.' })
  }

  try {
    await verifyAlexaRequest({
      certUrl: getHeader(event, 'signaturecertchainurl'),
      signature: getHeader(event, 'signature-256'),
      body,
      timestamp: envelope.request?.timestamp
    })
  } catch (error) {
    if (error instanceof AlexaVerificationError) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
    throw error
  }

  const skillId = useRuntimeConfig().alexaSkillId
  if (!skillId) {
    // Said in the console's simulator while setting the skill up.
    return speak('Serene is not set up for this skill yet. Add the skill ID to the app, then try again.')
  }
  if (applicationIdOf(envelope) !== skillId) {
    throw createError({ statusCode: 400, statusMessage: 'This skill is not allowed here.' })
  }

  return handleAlexaRequest(envelope)
})
