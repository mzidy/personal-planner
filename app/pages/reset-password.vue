<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

const route = useRoute()
const form = reactive({
  token: typeof route.query.token === 'string' ? route.query.token : '',
  password: ''
})
const pending = ref(false)
const message = ref('')

async function submit() {
  pending.value = true
  message.value = ''

  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: form
    })
    await navigateTo('/login')
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Unable to reset password.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <p class="eyebrow">Reset Password</p>
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.06em]">Set a new password.</h1>
      <p class="text-base leading-7 text-muted">
        Enter the reset token and choose a new password for the owner account.
      </p>
    </div>

    <form class="space-y-4" @submit.prevent="submit">
      <label class="block space-y-2">
        <span class="text-sm font-medium text-ink">Reset token</span>
        <input
          v-model="form.token"
          class="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none transition focus:border-accent/20"
          type="text"
          required
        />
      </label>
      <label class="block space-y-2">
        <span class="text-sm font-medium text-ink">New password</span>
        <input
          v-model="form.password"
          class="w-full rounded-2xl border border-outline/20 bg-surface px-4 py-3 outline-none transition focus:border-accent/20"
          type="password"
          autocomplete="new-password"
          required
        />
      </label>

      <p v-if="message" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ message }}
      </p>

      <button class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white transition hover:scale-[1.01]" :disabled="pending">
        {{ pending ? 'Updating password...' : 'Update password' }}
      </button>
    </form>

    <div class="text-sm text-muted">
      <NuxtLink class="text-ink" to="/login">Back to sign in</NuxtLink>
    </div>
  </div>
</template>
