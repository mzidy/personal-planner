<script setup lang="ts">
import { GENDERS, GENDER_LABELS, MAX_AGE, MIN_AGE, type Gender } from '~~/shared/utils/profile'

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
  password: '',
  gender: '' as Gender | '',
  birthDate: ''
})

const pending = ref(false)
const errorMessage = ref('')

/** The date picker only offers birth dates for ages the server accepts. */
function yearsAgo(years: number) {
  const date = new Date()
  date.setFullYear(date.getFullYear() - years)
  return date.toLocaleDateString('en-CA')
}
const latestBirthDate = yearsAgo(MIN_AGE)
const earliestBirthDate = yearsAgo(MAX_AGE)

async function submit() {
  if (!form.gender) {
    errorMessage.value = 'Choose a gender, or "Prefer not to say".'
    return
  }

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
    const fetchError = error as { data?: { statusMessage?: string; message?: string } }
    errorMessage.value = fetchError?.data?.statusMessage || fetchError?.data?.message || 'The account could not be created.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div v-if="bootstrap?.singleUserMode === false" class="space-y-3">
      <p class="eyebrow">Create account</p>
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.06em]">Start your own workspace.</h1>
      <p class="text-base leading-7 text-muted">Everything you add stays in your account; no one else sees it.</p>
    </div>
    <div v-else class="space-y-3">
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
        <span class="text-sm font-medium text-ink">Name</span>
        <input
          v-model="form.displayName"
          class="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none transition focus:border-accent/20"
          type="text"
          autocomplete="name"
          minlength="2"
          maxlength="80"
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
          minlength="10"
          maxlength="128"
          required
        />
        <span class="block text-xs text-muted">At least 10 characters.</span>
      </label>

      <fieldset class="space-y-2">
        <legend class="text-sm font-medium text-ink">Gender</legend>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Gender">
          <button
            v-for="gender in GENDERS"
            :key="gender"
            type="button"
            role="radio"
            :aria-checked="form.gender === gender"
            class="rounded-2xl border px-3 py-3 text-sm font-medium transition"
            :class="
              form.gender === gender
                ? 'border-ink bg-ink text-white'
                : 'border-outline/20 bg-surface text-ink hover:border-outline/40'
            "
            @click="form.gender = gender"
          >
            {{ GENDER_LABELS[gender] }}
          </button>
        </div>
      </fieldset>

      <label class="block space-y-2">
        <span class="text-sm font-medium text-ink">Date of birth</span>
        <input
          v-model="form.birthDate"
          class="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none transition focus:border-accent/20"
          type="date"
          autocomplete="bday"
          :min="earliestBirthDate"
          :max="latestBirthDate"
          required
        />
      </label>

      <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ errorMessage }}
      </p>

      <button
        class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white transition hover:scale-[1.01] disabled:opacity-60"
        :disabled="pending"
      >
        {{ pending ? 'Creating account...' : bootstrap?.singleUserMode === false ? 'Create account' : 'Create owner account' }}
      </button>
    </form>

    <div class="text-sm text-muted">
      Already have an account? <NuxtLink class="text-ink" to="/login">Sign in</NuxtLink>
    </div>
  </div>
</template>
