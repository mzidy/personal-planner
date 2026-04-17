declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    displayName: string
    avatarInitials: string
    emailVerified: boolean
    role: 'owner'
  }

  interface UserSession {
    loggedInAt: string
    provider: 'password' | 'google'
  }

  interface SecureSessionData {
    userId: string
  }
}

export {}
