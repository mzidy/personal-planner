<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const route = useRoute()
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const pending = ref(false)
const message = ref('')
const success = ref(false)

async function verify() {
  pending.value = true
  message.value = ''

  try {
    await $fetch('/api/auth/verify-email', {
      method: 'POST',
      body: {
        token: token.value
      }
    })
    success.value = true
    message.value = 'Email verification completed. Your account is now trusted for the full workspace.'
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Unable to verify this email token.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <p class="eyebrow">Email Verification</p>
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.06em]">Confirm the owner identity.</h1>
      <p class="text-base leading-7 text-muted">
        Complete email verification to mark this single-user workspace as fully initialized.
      </p>
    </div>

    <label class="block space-y-2">
      <span class="text-sm font-medium text-ink">Verification token</span>
      <input
        v-model="token"
        class="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none transition focus:border-accent/20"
        type="text"
      />
    </label>

    <button class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white transition hover:scale-[1.01]" :disabled="pending" @click="verify">
      {{ pending ? 'Verifying...' : 'Verify email' }}
    </button>

    <p
      v-if="message"
      class="rounded-2xl px-4 py-3 text-sm"
      :class="success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
    >
      {{ message }}
    </p>

    <div class="text-sm text-muted">
      <NuxtLink class="text-ink" to="/login">Return to sign in</NuxtLink>
    </div>
  </div>
</template>
