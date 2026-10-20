import { roborockCodeRequestSchema } from '~~/shared/schemas/smart-home'
import { findRoborockRegion, newClientIdentifier, requestRoborockCode } from '~~/server/utils/roborock-api'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { smartHomeHttpError } from '~~/server/utils/smart-home-vacuum'

/** Step 1 of connecting: Roborock emails a login code to the account's address. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  // Roborock itself allows about three code requests a minute and ten an hour.
  await assertRateLimit(event, 'roborock-code', 3, 60_000)
  const { email } = roborockCodeRequestSchema.parse(await readBody(event))
  const repository = useSmartHomeRepository()

  const clientIdentifier = newClientIdentifier()
  try {
    const region = await requestRoborockCode(await findRoborockRegion(email), email, clientIdentifier)
    await repository.saveCodeRequest(user.id, email, region, clientIdentifier)
  } catch (error) {
    throw smartHomeHttpError(error)
  }
  return repository.overview(user.id)
})
