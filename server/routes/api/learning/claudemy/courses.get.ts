import { useClaudemyRepository } from '~~/server/utils/claudemy-repository'

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  return useClaudemyRepository().listCourses(user.id)
})
