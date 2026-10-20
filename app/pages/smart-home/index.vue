<script setup lang="ts">
import type { SmartHomeOverview } from '~~/shared/types/smart-home'

definePageMeta({
  middleware: 'protected'
})

useHead({ title: 'Smart Home' })

const { data: overview } = await usePlannerFetch<SmartHomeOverview>('smart-home', '/api/smart-home')

const email = ref(overview.value?.account?.email || '')
const code = ref('')
const pending = ref<'code' | 'login' | 'devices' | 'disconnect' | null>(null)
const errorMessage = ref('')
const notice = ref('')

const account = computed(() => overview.value?.account || null)
const devices = computed(() => overview.value?.devices || [])
const awaitingCode = computed(() => account.value?.status === 'awaiting_code' || notice.value !== '')
const connected = computed(() => account.value?.status === 'connected')

function messageOf(error: unknown, fallback: string) {
  const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
  return fetchError?.data?.statusMessage || fetchError?.data?.message || fetchError?.message || fallback
}

async function requestCode() {
  if (!email.value.trim() || pending.value) {
    return
  }
  pending.value = 'code'
  errorMessage.value = ''
  try {
    overview.value = await $fetch<SmartHomeOverview>('/api/smart-home/roborock/code', {
      method: 'POST',
      body: { email: email.value.trim() }
    })
    notice.value = `Roborock sent a login code to ${email.value.trim()}.`
    code.value = ''
  } catch (error) {
    errorMessage.value = messageOf(error, 'Could not ask Roborock for a code.')
  } finally {
    pending.value = null
  }
}

async function login() {
  if (!code.value.trim() || pending.value) {
    return
  }
  pending.value = 'login'
  errorMessage.value = ''
  try {
    overview.value = await $fetch<SmartHomeOverview>('/api/smart-home/roborock/login', {
      method: 'POST',
      body: { code: code.value.trim() }
    })
    notice.value = ''
    code.value = ''
  } catch (error) {
    errorMessage.value = messageOf(error, 'The login did not work.')
  } finally {
    pending.value = null
  }
}

async function refreshDevices() {
  pending.value = 'devices'
  errorMessage.value = ''
  try {
    overview.value = await $fetch<SmartHomeOverview>('/api/smart-home/roborock/devices', { method: 'POST' })
  } catch (error) {
    errorMessage.value = messageOf(error, 'Could not reload the devices.')
  } finally {
    pending.value = null
  }
}

async function disconnect() {
  if (!window.confirm('Disconnect the Roborock account? The vacuum keeps working in the Roborock app.')) {
    return
  }
  pending.value = 'disconnect'
  errorMessage.value = ''
  try {
    await $fetch('/api/smart-home/roborock', { method: 'DELETE' })
    overview.value = { account: null, devices: [] }
    notice.value = ''
  } catch (error) {
    errorMessage.value = messageOf(error, 'Could not disconnect.')
  } finally {
    pending.value = null
  }
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Smart Home"
      title="Your home, from here."
      subtitle="Devices you can see and control from the planner. Starting with the Roborock vacuum, through the same cloud the Roborock app uses."
    >
      <template v-if="connected" #aside>
        <div class="flex flex-col items-start gap-2 text-sm md:items-end">
          <span class="text-muted">Roborock · {{ account!.email }}<template v-if="account!.region"> · {{ account!.region }}</template></span>
          <div class="flex gap-2">
            <button
              class="rounded-full bg-surface-low px-4 py-2 font-semibold text-ink disabled:opacity-50"
              :disabled="pending !== null"
              @click="refreshDevices"
            >
              {{ pending === 'devices' ? 'Reloading…' : 'Reload devices' }}
            </button>
            <button
              class="rounded-full bg-surface-low px-4 py-2 font-semibold text-rose-700 disabled:opacity-50"
              :disabled="pending !== null"
              @click="disconnect"
            >
              Disconnect
            </button>
          </div>
        </div>
      </template>
    </AppPageHero>

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</p>

    <PanelCard v-if="!connected || awaitingCode" class="max-w-2xl space-y-5">
      <div>
        <p class="eyebrow">{{ connected ? 'Connect again' : 'Connect Roborock' }}</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Sign in with your Roborock app account.</h2>
        <p class="mt-2 text-sm leading-6 text-muted">
          Roborock emails a code to the address of your Roborock app account. Your password is never asked for, and the
          session Roborock returns is stored encrypted. A Mi Home account will not work here; the vacuum has to be in the
          Roborock app.
        </p>
      </div>

      <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="requestCode">
        <input
          v-model="email"
          class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
          type="email"
          autocomplete="email"
          placeholder="Email of your Roborock account"
          required
        />
        <button
          class="shrink-0 rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
          :disabled="pending !== null || !email.trim()"
        >
          {{ pending === 'code' ? 'Sending…' : awaitingCode ? 'Send a new code' : 'Send code' }}
        </button>
      </form>

      <template v-if="awaitingCode">
        <p v-if="notice" class="rounded-2xl bg-teal/15 px-4 py-3 text-sm text-accent">{{ notice }}</p>
        <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="login">
          <input
            v-model="code"
            class="w-full rounded-2xl bg-surface-low px-4 py-3 tracking-[0.3em] outline-none"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="8"
            placeholder="Code from the email"
            required
          />
          <button
            class="shrink-0 rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
            :disabled="pending !== null || !code.trim()"
          >
            {{ pending === 'login' ? 'Connecting…' : 'Connect' }}
          </button>
        </form>
      </template>
    </PanelCard>

    <template v-if="connected">
      <p v-if="!devices.length" class="text-sm text-muted">
        No devices on this Roborock account. Add the vacuum in the Roborock app, then reload the devices.
      </p>
      <div class="grid gap-6 2xl:grid-cols-2">
        <SmartHomeVacuumCard v-for="device in devices" :key="device.id" :device="device" />
      </div>
    </template>
  </div>
</template>
