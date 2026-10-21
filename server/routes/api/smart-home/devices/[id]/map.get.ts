import { parseRoborockMap, toMapView } from '~~/server/utils/roborock-map'
import { resolveVacuum, smartHomeHttpError } from '~~/server/utils/smart-home-vacuum'

/** The vacuum's current map, cropped and ready to draw. */
export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'vacuum-map', 10, 60_000)
  const vacuum = await resolveVacuum(user.id, getRouterParam(event, 'id') || '')
  if (!vacuum.fetchMap) {
    throw createError({ statusCode: 409, statusMessage: 'The map is available for vacuums connected through Xiaomi Home for now.' })
  }

  let raw: Buffer
  try {
    raw = await vacuum.fetchMap()
  } catch (error) {
    throw smartHomeHttpError(error)
  }
  try {
    return toMapView(parseRoborockMap(raw), new Date().toISOString())
  } catch (error) {
    throw createError({ statusCode: 502, statusMessage: `The map could not be read: ${(error as Error).message}.` })
  }
})
