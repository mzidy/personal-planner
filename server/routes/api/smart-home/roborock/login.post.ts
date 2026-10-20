import { roborockLoginSchema } from '~~/shared/schemas/smart-home'
import { listRoborockDevices, loginRoborockWithCode } from '~~/server/utils/roborock-api'
import { useSmartHomeRepository } from '~~/server/utils/smart-home-repository'
import { smartHomeHttpError } from '~~/server/utils/smart-home-vacuum'

/** Step 2: log in with the emailed code, keep the session (sealed), and list the devices. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'roborock-login', 5, 60_000)
  const { code } = roborockLoginSchema.parse(await readBody(event))
  const repository = useSmartHomeRepository()

  const found = await repository.findAccount(user.id)
  if (!found) {
    throw createError({ statusCode: 409, statusMessage: 'Ask for a code first.' })
  }
  const { account, region } = found

  try {
    const session = await loginRoborockWithCode(region, account.email, account.clientIdentifier, code)
    await repository.saveSession(account.id, session)
    const devices = await listRoborockDevices(region, account.email, account.clientIdentifier, session)
    await repository.syncDevices(user.id, account.id, devices)
  } catch (error) {
    throw smartHomeHttpError(error)
  }

  await usePlannerRepository().createAuditEvent(user.id, 'connect', 'smart-home-account', account.id, { provider: 'roborock' })
  return repository.overview(user.id)
})
