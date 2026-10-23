import { establishSession } from '~~/server/utils/auth-session'

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    const repository = usePlannerRepository()
    const config = useRuntimeConfig()

    let appUser = await repository.findUserByIdentity('google', user.sub)

    if (!appUser && user.email) {
      const byEmail = await repository.findUserByEmail(user.email)
      // Registration is open and nothing confirms the email it was given, so an
      // unverified account with this address may have been set up by someone
      // else, who knows its password. Linking Google to it would sign the real
      // owner of the address into that account.
      if (byEmail && !byEmail.emailVerified) {
        return sendRedirect(event, '/login?oauth=email-unverified')
      }
      appUser = byEmail
    }

    if (!appUser) {
      const existingUsers = await repository.countUsers()
      if (config.singleUserMode && existingUsers > 0) {
        return sendRedirect(event, '/login?oauth=workspace-locked')
      }

      appUser = await repository.createUser({
        email: user.email || `google-${user.sub}@placeholder.local`,
        displayName: user.name || 'Google User',
        passwordHash: null,
        emailVerified: true
      })
    }

    await repository.linkIdentity(appUser.id, 'google', user.sub)
    await repository.markEmailVerified(appUser.id)
    await repository.createAuditEvent(appUser.id, 'oauth-login', 'session', null, { provider: 'google' })
    await establishSession(event, appUser, 'google')

    return sendRedirect(event, '/dashboard')
  },
  onError(event) {
    return sendRedirect(event, '/login?oauth=error')
  }
})
