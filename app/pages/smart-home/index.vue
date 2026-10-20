<script setup lang="ts">
import type { SmartHomeOverview, SmartHomeProvider } from '~~/shared/types/smart-home'

definePageMeta({
  middleware: 'protected'
})

useHead({ title: 'Smart Home' })

const { data: overview } = await usePlannerFetch<SmartHomeOverview>('smart-home', '/api/smart-home')

const roborock = computed(() => overview.value?.accounts.roborock || null)
const xiaomi = computed(() => overview.value?.accounts.xiaomi || null)
const devices = computed(() => overview.value?.devices || [])

type Pending = 'code' | 'login' | 'qr' | 'devices-roborock' | 'devices-xiaomi' | 'disconnect-roborock' | 'disconnect-xiaomi'
const pending = ref<Pending | null>(null)
const errorMessage = ref('')

function messageOf(error: unknown, fallback: string) {
  const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
  return fetchError?.data?.statusMessage || fetchError?.data?.message || fetchError?.message || fallback
}

// ---------------------------------------------------------------- Roborock app

const email = ref(roborock.value?.email || '')
const code = ref('')
const notice = ref('')
const roborockAwaitingCode = computed(() => roborock.value?.status === 'awaiting_code' || notice.value !== '')

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

// ---------------------------------------------------------------- Xiaomi Home

const scanning = computed(() => xiaomi.value?.status === 'awaiting_scan' && Boolean(xiaomi.value.qrImageUrl))
let polling = false
let alive = true

async function showQr() {
  pending.value = 'qr'
  errorMessage.value = ''
  try {
    overview.value = await $fetch<SmartHomeOverview>('/api/smart-home/xiaomi/qr', { method: 'POST' })
    waitForScan()
  } catch (error) {
    errorMessage.value = messageOf(error, 'Could not get a QR code from Xiaomi.')
  } finally {
    pending.value = null
  }
}

/** Each request waits up to ~20 s on Xiaomi's side, so this loop is gentle on its own. */
async function waitForScan() {
  if (polling) {
    return
  }
  polling = true
  try {
    while (alive && scanning.value) {
      const result = await $fetch<SmartHomeOverview & { scanned: boolean }>('/api/smart-home/xiaomi/poll', { method: 'POST' })
      overview.value = { accounts: result.accounts, devices: result.devices }
    }
  } catch (error) {
    errorMessage.value = messageOf(error, 'The Xiaomi login did not finish.')
    overview.value = await $fetch<SmartHomeOverview>('/api/smart-home').catch(() => overview.value)
  } finally {
    polling = false
  }
}

onMounted(() => {
  if (scanning.value) {
    waitForScan()
  }
})
onBeforeUnmount(() => {
  alive = false
})

// ---------------------------------------------------------------- both

async function refreshDevices(provider: SmartHomeProvider) {
  pending.value = `devices-${provider}`
  errorMessage.value = ''
  try {
    overview.value = await $fetch<SmartHomeOverview>(`/api/smart-home/${provider}/devices`, { method: 'POST' })
  } catch (error) {
    errorMessage.value = messageOf(error, 'Could not reload the devices.')
  } finally {
    pending.value = null
  }
}

async function disconnect(provider: SmartHomeProvider) {
  const app = provider === 'xiaomi' ? 'Xiaomi Home' : 'Roborock'
  if (!window.confirm(`Disconnect the ${app} account? The vacuum keeps working in the ${app} app.`)) {
    return
  }
  pending.value = `disconnect-${provider}`
  errorMessage.value = ''
  try {
    await $fetch(`/api/smart-home/${provider}`, { method: 'DELETE' })
    overview.value = await $fetch<SmartHomeOverview>('/api/smart-home')
    if (provider === 'roborock') {
      notice.value = ''
    }
  } catch (error) {
    errorMessage.value = messageOf(error, 'Could not disconnect.')
  } finally {
    pending.value = null
  }
}

function expiresAt(value: string | null) {
  return value ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Smart Home"
      title="Your home, from here."
      subtitle="Devices you can see and control from the planner, through the same clouds their own apps use. Starting with the robot vacuum, from either the Xiaomi Home or the Roborock app."
    />

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</p>

    <div class="grid gap-6 xl:grid-cols-2">
      <!-- Xiaomi Home -->
      <PanelCard class="space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="eyebrow">Xiaomi Home</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
              {{ xiaomi?.connectedAt ? 'Connected.' : 'Connect with a QR code.' }}
            </h2>
            <p v-if="xiaomi?.connectedAt" class="mt-1 text-sm text-muted">
              {{ xiaomi.email }}<template v-if="xiaomi.region"> · server {{ xiaomi.region }}</template>
            </p>
          </div>
          <StatusPill v-if="xiaomi?.connectedAt" label="Connected" tone="teal" />
        </div>

        <p v-if="!xiaomi?.connectedAt && !scanning" class="text-sm leading-6 text-muted">
          For a vacuum in the Xiaomi Home app. You scan a code with the app and confirm on the phone; no password is asked
          for, and the session Xiaomi returns is stored encrypted.
        </p>

        <div v-if="scanning" class="flex flex-col gap-5 sm:flex-row sm:items-center">
          <img
            :src="xiaomi!.qrImageUrl!"
            alt="QR code to log in to Xiaomi"
            class="h-44 w-44 shrink-0 rounded-soft bg-white p-2"
            referrerpolicy="no-referrer"
          />
          <div class="space-y-2 text-sm leading-6">
            <p class="font-semibold">Scan this with the Xiaomi Home app.</p>
            <p class="text-muted">
              In Xiaomi Home, tap <span class="font-semibold text-ink">+</span> at the top right, choose
              <span class="font-semibold text-ink">Scan</span>, scan the code and confirm the login on the phone. This
              page carries on by itself.
            </p>
            <p class="text-xs text-muted">Waiting for the scan… The code works until {{ expiresAt(xiaomi!.qrExpiresAt) }}.</p>
            <p class="text-xs text-muted sm:hidden">
              On the phone with Xiaomi Home? Open this page on a computer or tablet and scan it from there.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="!scanning"
            class="rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-50"
            :class="xiaomi?.connectedAt ? 'bg-surface-low text-ink' : 'bg-ink text-white'"
            :disabled="pending !== null"
            @click="showQr"
          >
            {{ pending === 'qr' ? 'Getting a code…' : xiaomi?.connectedAt ? 'Connect again' : 'Show QR code' }}
          </button>
          <template v-if="xiaomi?.connectedAt">
            <button
              class="rounded-full bg-surface-low px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
              :disabled="pending !== null"
              @click="refreshDevices('xiaomi')"
            >
              {{ pending === 'devices-xiaomi' ? 'Reloading…' : 'Reload devices' }}
            </button>
            <button
              class="rounded-full bg-surface-low px-5 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50"
              :disabled="pending !== null"
              @click="disconnect('xiaomi')"
            >
              Disconnect
            </button>
          </template>
        </div>
      </PanelCard>

      <!-- Roborock app -->
      <PanelCard class="space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="eyebrow">Roborock app</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
              {{ roborock?.connectedAt ? 'Connected.' : 'Connect with an emailed code.' }}
            </h2>
            <p v-if="roborock?.connectedAt" class="mt-1 text-sm text-muted">
              {{ roborock.email }}<template v-if="roborock.region"> · {{ roborock.region }}</template>
            </p>
          </div>
          <StatusPill v-if="roborock?.connectedAt" label="Connected" tone="teal" />
        </div>

        <template v-if="!roborock?.connectedAt || roborockAwaitingCode">
          <p class="text-sm leading-6 text-muted">
            For a vacuum in the Roborock app. Roborock emails a code to the account's address; no password is asked for.
          </p>
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
              class="shrink-0 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="pending !== null || !email.trim()"
            >
              {{ pending === 'code' ? 'Sending…' : roborockAwaitingCode ? 'Send a new code' : 'Send code' }}
            </button>
          </form>
          <template v-if="roborockAwaitingCode">
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
                class="shrink-0 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                :disabled="pending !== null || !code.trim()"
              >
                {{ pending === 'login' ? 'Connecting…' : 'Connect' }}
              </button>
            </form>
          </template>
        </template>

        <div v-if="roborock?.connectedAt" class="flex flex-wrap gap-2">
          <button
            class="rounded-full bg-surface-low px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
            :disabled="pending !== null"
            @click="refreshDevices('roborock')"
          >
            {{ pending === 'devices-roborock' ? 'Reloading…' : 'Reload devices' }}
          </button>
          <button
            class="rounded-full bg-surface-low px-5 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50"
            :disabled="pending !== null"
            @click="disconnect('roborock')"
          >
            Disconnect
          </button>
        </div>
      </PanelCard>
    </div>

    <p v-if="(xiaomi?.connectedAt || roborock?.connectedAt) && !devices.length" class="text-sm text-muted">
      No vacuums on the connected accounts yet. Add the vacuum in its app, then reload the devices.
    </p>
    <div v-if="devices.length" class="grid gap-6 2xl:grid-cols-2">
      <SmartHomeVacuumCard v-for="device in devices" :key="device.id" :device="device" />
    </div>
  </div>
</template>
