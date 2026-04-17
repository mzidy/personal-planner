<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

const form = reactive({
  email: ''
})

const pending = ref(false)
const message = ref('')
const debugToken = ref('')

async function submit() {
  pending.value = true
  message.value = ''

  try {
    const response = await $fetch<{ sent: boolean; debugToken?: string }>('/api/auth/request-password-reset', {
      method: 'POST',
      body: form
    })

    debugToken.value = response.debugToken || ''
    message.value = 'If the account exists, a reset flow has been prepared.'
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Unable to start the reset flow.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <p class="eyebrow">Password Reset</p>
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.06em]">Recover access.</h1>
      <p class="text-base leading-7 text-muted">
        Start a password reset for the owner account. In demo mode, the token is surfaced directly so
        the flow remains testable without email delivery.
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

      <button class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white transition hover:scale-[1.01]" :disabled="pending">
        {{ pending ? 'Preparing reset...' : 'Prepare reset link' }}
      </button>
    </form>

    <p v-if="message" class="rounded-2xl bg-surface-low px-4 py-3 text-sm text-muted">
      {{ message }}
    </p>

    <NuxtLink
      v-if="debugToken"
      class="inline-flex rounded-full bg-surface-low px-5 py-3 font-semibold text-ink"
      :to="`/reset-password?token=${debugToken}`"
    >
      Continue with demo reset token
    </NuxtLink>

    <div class="text-sm text-muted">
      Remembered it? <NuxtLink class="text-ink" to="/login">Back to sign in</NuxtLink>
    </div>
  </div>
</template>
