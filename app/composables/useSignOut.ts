/** Ends the session and returns to the sign-in page. */
export function useSignOut() {
  const { clear } = useUserSession()

  return async function signOut() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    await clear()
    await navigateTo('/login')
  }
}
