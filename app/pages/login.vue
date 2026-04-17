<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

const route = useRoute()
const { data: bootstrap } = await usePlannerFetch<{
  demoMode: boolean
  singleUserMode: boolean
  canRegister: boolean
  demoCredentials: { email: string; password: string } | null
}>('auth-bootstrap', '/api/auth/bootstrap')

const form = reactive({
  email: bootstrap.value?.demoCredentials?.email || '',
  password: bootstrap.value?.demoCredentials?.password || ''
})

const pending = ref(false)
const resetPending = ref(false)
const errorMessage = ref('')

async function submit() {
  pending.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: form
    })
    await reloadNuxtApp({ path: '/dashboard', ttl: 0 })
  } catch (error) {
    const fetchError = error as {
      data?: { statusMessage?: string; message?: string }
      statusMessage?: string
      message?: string
    }
    errorMessage.value =
      fetchError?.data?.statusMessage ||
      fetchError?.data?.message ||
      fetchError?.statusMessage ||
      fetchError?.message ||
      'Unable to sign in.'
  } finally {
    pending.value = false
  }
}

async function resetDemoWorkspace() {
  resetPending.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch<{
      demoCredentials: { email: string; password: string }
    }>('/api/auth/reset-demo', {
      method: 'POST'
    })

    form.email = response.demoCredentials.email
    form.password = response.demoCredentials.password
    await reloadNuxtApp({ path: '/login', ttl: 0 })
  } catch (error) {
    const fetchError = error as {
      data?: { statusMessage?: string; message?: string }
      statusMessage?: string
      message?: string
    }
    errorMessage.value =
      fetchError?.data?.statusMessage ||
      fetchError?.data?.message ||
      fetchError?.statusMessage ||
      fetchError?.message ||
      'Unable to reset the local demo workspace.'
  } finally {
    resetPending.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <p class="eyebrow">Secure Sign In</p>
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.06em]">Welcome back.</h1>
      <p class="text-base leading-7 text-muted">
        Sign in to your private planning workspace. OAuth and password login share the same sealed
        session model.
      </p>
    </div>

    <form class="space-y-4" @submit.prevent="submit">
      <label class="block space-y-2">
        <span class="text-sm font-medium text-ink">Email</span>
        <input
          v-model="form.email"
          class="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none transition focus:border-accent/20"
          type="email"
          autocomplete="email"
          required
        />
      </label>
      <label class="block space-y-2">
        <span class="text-sm font-medium text-ink">Password</span>
        <input
          v-model="form.password"
          class="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none transition focus:border-accent/20"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>

      <p v-if="route.query.oauth === 'error'" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Google OAuth did not complete successfully. Please try again.
      </p>
      <p v-if="route.query.oauth === 'workspace-locked'" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
        This single-user workspace is already claimed. Sign in with the original owner account.
      </p>
      <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ errorMessage }}
      </p>
      <p
        v-if="!bootstrap?.demoCredentials && bootstrap?.demoMode"
        class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700"
      >
        Demo credentials are no longer active for this local workspace. Sign in with the current
        owner account or reinitialize the workspace.
      </p>
      <button
        v-if="!bootstrap?.demoCredentials && bootstrap?.demoMode"
        class="w-full rounded-full border border-outline/20 bg-surface px-5 py-3 font-semibold text-ink transition hover:bg-surface-low"
        :disabled="resetPending"
        type="button"
        @click="resetDemoWorkspace"
      >
        {{ resetPending ? 'Resetting local demo workspace...' : 'Reset local demo workspace' }}
      </button>

      <button
        class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white transition hover:scale-[1.01]"
        :disabled="pending"
        type="submit"
      >
        {{ pending ? 'Signing in...' : 'Sign in with password' }}
      </button>
    </form>

    <div class="rounded-panel border border-outline/15 bg-surface px-6 py-6">
      <p class="eyebrow">OAuth</p>
      <a
        class="mt-3 flex w-full items-center justify-center rounded-full bg-surface-low px-5 py-3 font-semibold text-ink transition hover:bg-surface-high"
        href="/auth/google"
      >
        Continue with Google
      </a>
    </div>

    <div
      v-if="bootstrap?.demoCredentials"
      class="rounded-panel border border-dashed border-outline/25 bg-surface-low px-6 py-5 text-sm text-muted"
    >
      <p class="font-semibold text-ink">Demo workspace credentials</p>
      <p class="mt-2">{{ bootstrap.demoCredentials.email }}</p>
      <p>{{ bootstrap.demoCredentials.password }}</p>
    </div>

    <div class="flex items-center justify-between text-sm text-muted">
      <NuxtLink class="hover:text-ink" to="/forgot-password">Forgot password?</NuxtLink>
      <NuxtLink class="hover:text-ink" to="/register">Need to initialize the workspace?</NuxtLink>
    </div>
  </div>
</template>
