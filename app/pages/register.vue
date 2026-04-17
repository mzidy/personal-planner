<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

const { data: bootstrap } = await usePlannerFetch<{
  demoMode: boolean
  singleUserMode: boolean
  canRegister: boolean
}>('register-bootstrap', '/api/auth/bootstrap')

const form = reactive({
  displayName: '',
  email: '',
  password: ''
})

const pending = ref(false)
const errorMessage = ref('')

async function submit() {
  pending.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch<{ debugToken?: string }>('/api/auth/register', {
      method: 'POST',
      body: form
    })

    if (response.debugToken) {
      await reloadNuxtApp({ path: `/verify-email?token=${response.debugToken}`, ttl: 0 })
      return
    }

    await reloadNuxtApp({ path: '/dashboard', ttl: 0 })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to register this workspace.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <p class="eyebrow">Initialize Workspace</p>
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.06em]">Claim the private account.</h1>
      <p class="text-base leading-7 text-muted">
        This product is scoped as a single-user workspace. Registration is available only before the
        owner account is created.
      </p>
    </div>

    <div
      v-if="bootstrap && !bootstrap.canRegister"
      class="rounded-panel border border-outline/15 bg-surface-low px-6 py-6 text-sm leading-7 text-muted"
    >
      <p class="font-semibold text-ink">This workspace is already initialized.</p>
      <p class="mt-2">Use the owner credentials or Google OAuth on the sign-in page instead.</p>
      <NuxtLink class="mt-4 inline-flex rounded-full bg-ink px-5 py-3 font-semibold text-white" to="/login">
        Back to sign in
      </NuxtLink>
    </div>

    <form v-else class="space-y-4" @submit.prevent="submit">
      <label class="block space-y-2">
        <span class="text-sm font-medium text-ink">Display name</span>
        <input
          v-model="form.displayName"
          class="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none transition focus:border-accent/20"
          type="text"
          autocomplete="name"
          required
        />
      </label>
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
          autocomplete="new-password"
          required
        />
      </label>

      <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ errorMessage }}
      </p>

      <button class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white transition hover:scale-[1.01]" :disabled="pending">
        {{ pending ? 'Creating account...' : 'Create owner account' }}
      </button>
    </form>

    <div class="text-sm text-muted">
      Already initialized? <NuxtLink class="text-ink" to="/login">Return to sign in</NuxtLink>
    </div>
  </div>
</template>
