import { useClaudemyRepository } from '~~/server/utils/claudemy-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  const view = await useClaudemyRepository().view(user.id, getRouterParam(event, 'id') || '')
  if (!view) {
    throw createError({ statusCode: 404, statusMessage: 'Course not found.' })
  }
  return view
})
