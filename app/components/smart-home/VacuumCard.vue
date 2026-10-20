<script setup lang="ts">
import { BatteryMedium, Fan, House, MapPin, Pause, Play, RefreshCw } from 'lucide-vue-next'
import type { SmartHomeDevice, VacuumAction, VacuumConsumables, VacuumStatus, VacuumSummary } from '~~/shared/types/smart-home'

const props = defineProps<{
  device: SmartHomeDevice
}>()

/** How often the status is asked for while the page is visible. Each ask is one round trip through Roborock's cloud. */
const POLL_MS = 20_000

const status = ref<VacuumStatus | null>(props.device.lastStatus)
const consumables = ref<VacuumConsumables | null>(null)
const summary = ref<VacuumSummary | null>(null)
const online = ref(props.device.online)
const loading = ref(false)
const busy = ref<VacuumAction | null>(null)
const errorMessage = ref('')
let timer: ReturnType<typeof setInterval> | null = null
let settle: ReturnType<typeof setTimeout> | null = null

function messageOf(error: unknown, fallback: string) {
  const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
  return fetchError?.data?.statusMessage || fetchError?.data?.message || fetchError?.message || fallback
}

async function refresh(details = false) {
  if (!props.device.supported || loading.value) {
    return
  }
  loading.value = true
  try {
    const result = await $fetch<{ status: VacuumStatus; consumables: VacuumConsumables | null; summary: VacuumSummary | null }>(
      `/api/smart-home/devices/${props.device.id}/status`,
      { query: details ? { details: '1' } : {} }
    )
    status.value = result.status
    online.value = result.status.state !== 101
    if (details) {
      consumables.value = result.consumables
      summary.value = result.summary
    }
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = messageOf(error, 'Could not reach the vacuum.')
    const code = (error as { statusCode?: number })?.statusCode
    if (code === 504) {
      online.value = false
    }
  } finally {
    loading.value = false
  }
}

async function send(action: VacuumAction, value?: number) {
  busy.value = action
  errorMessage.value = ''
  try {
    await $fetch(`/api/smart-home/devices/${props.device.id}/command`, {
      method: 'POST',
      body: value === undefined ? { action } : { action, value }
    })
    // The robot takes a moment to change state after it accepts a command.
    if (settle) {
      clearTimeout(settle)
    }
    settle = setTimeout(() => refresh(), 2500)
  } catch (error) {
    errorMessage.value = messageOf(error, 'The command did not go through.')
  } finally {
    busy.value = null
  }
}

function onFanChange(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (Number.isFinite(value)) {
    send('fan', value)
  }
}

function startPolling() {
  stopPolling()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      refresh()
    }
  }, POLL_MS)
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') {
    refresh()
  }
}

onMounted(() => {
  refresh(true)
  startPolling()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopPolling()
  if (settle) {
    clearTimeout(settle)
  }
  document.removeEventListener('visibilitychange', onVisibility)
})

const batteryTone = computed(() => {
  const battery = status.value?.battery ?? 100
  return battery < 20 ? 'bg-rose-500' : battery < 50 ? 'bg-amber-400' : 'bg-teal'
})

const checked = computed(() =>
  status.value ? new Date(status.value.checkedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
)

const parts = computed(() =>
  consumables.value
    ? [
        { label: 'Main brush', value: consumables.value.mainBrush },
        { label: 'Side brush', value: consumables.value.sideBrush },
        { label: 'Filter', value: consumables.value.filter },
        { label: 'Sensors', value: consumables.value.sensors }
      ].filter(part => part.value !== null)
    : []
)
</script>

<template>
  <PanelCard class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="eyebrow">{{ device.productName || 'Roborock' }}<template v-if="device.model"> · {{ device.model }}</template></p>
        <h2 class="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">{{ device.name }}</h2>
      </div>
      <div class="flex items-center gap-2">
        <StatusPill :label="online ? 'Online' : 'Offline'" :tone="online ? 'teal' : 'danger'" />
        <button
          v-if="device.supported"
          class="rounded-full bg-surface-low p-2 text-muted transition hover:text-ink disabled:opacity-50"
          :disabled="loading"
          title="Refresh"
          @click="refresh(true)"
        >
          <RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>

    <p v-if="!device.supported" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      <template v-if="device.provider === 'xiaomi'">
        {{ device.model }} is not a Roborock-made vacuum, so it takes different commands, which this app does not send
        yet. Roborock-made vacuums in Xiaomi Home (models starting with roborock.vacuum or rockrobo.vacuum) work.
      </template>
      <template v-else>
        This device uses Roborock protocol {{ device.protocolVersion }}, which this app cannot control yet. Only "1.0"
        devices (most Roborock vacuums, including the S5, S6, S7, S8 and Q5 lines) are supported.
      </template>
    </p>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-soft bg-surface-low px-5 py-4">
          <p class="eyebrow">{{ online ? 'Status' : 'Last known' }}</p>
          <p class="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">{{ status?.stateLabel || '…' }}</p>
          <p v-if="status && (status.cleanMinutes || status.cleanAreaM2)" class="mt-1 text-xs text-muted">
            Last run {{ status.cleanMinutes }} min<template v-if="status.cleanAreaM2 !== null"> · {{ status.cleanAreaM2 }} m²</template>
          </p>
        </div>
        <div class="rounded-soft bg-surface-low px-5 py-4">
          <p class="eyebrow flex items-center gap-1.5"><BatteryMedium class="h-3.5 w-3.5" /> Battery</p>
          <p class="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">
            {{ status?.battery ?? '…' }}<span v-if="status?.battery !== null && status?.battery !== undefined">%</span>
          </p>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
            <div class="h-full rounded-full transition-all" :class="batteryTone" :style="{ width: `${status?.battery ?? 0}%` }" />
          </div>
        </div>
        <label class="block rounded-soft bg-surface-low px-5 py-4">
          <span class="eyebrow flex items-center gap-1.5"><Fan class="h-3.5 w-3.5" /> Suction</span>
          <select
            class="mt-2 w-full rounded-xl bg-surface px-3 py-2 text-sm font-semibold outline-none disabled:opacity-50"
            :disabled="!status || busy !== null"
            :value="status?.fanPower ?? ''"
            @change="onFanChange"
          >
            <option v-if="status && !status.fanOptions.some(option => option.value === status!.fanPower)" :value="status.fanPower ?? ''">
              {{ status.fanLabel || 'Unknown' }}
            </option>
            <option v-for="option in status?.fanOptions || []" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>

      <p v-if="status?.errorLabel" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        The vacuum reports: {{ status.errorLabel }}
      </p>

      <div class="flex flex-wrap gap-3">
        <button
          v-if="!status?.active"
          class="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="busy !== null"
          @click="send('start')"
        >
          <Play class="h-4 w-4" /> {{ busy === 'start' ? 'Starting…' : status?.state === 10 ? 'Resume' : 'Start cleaning' }}
        </button>
        <button
          v-else
          class="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="busy !== null"
          @click="send('pause')"
        >
          <Pause class="h-4 w-4" /> {{ busy === 'pause' ? 'Pausing…' : 'Pause' }}
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-full bg-surface-low px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
          :disabled="busy !== null || status?.onDock"
          @click="send('dock')"
        >
          <House class="h-4 w-4" /> {{ busy === 'dock' ? 'Sending home…' : 'Back to dock' }}
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-full bg-surface-low px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
          :disabled="busy !== null"
          @click="send('find')"
        >
          <MapPin class="h-4 w-4" /> {{ busy === 'find' ? 'Calling…' : 'Find it' }}
        </button>
      </div>

      <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</p>

      <div v-if="parts.length || summary" class="grid gap-6 border-t ghost-divider pt-5 sm:grid-cols-2">
        <div v-if="parts.length" class="space-y-3">
          <p class="eyebrow">Parts, life left</p>
          <div v-for="part in parts" :key="part.label" class="space-y-1">
            <div class="flex justify-between text-sm">
              <span>{{ part.label }}</span>
              <span :class="(part.value ?? 100) < 10 ? 'font-semibold text-rose-700' : 'text-muted'">{{ part.value }}%</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-surface-low">
              <div
                class="h-full rounded-full"
                :class="(part.value ?? 100) < 10 ? 'bg-rose-500' : 'bg-ink'"
                :style="{ width: `${part.value}%` }"
              />
            </div>
          </div>
        </div>
        <div v-if="summary" class="space-y-3">
          <p class="eyebrow">All time</p>
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="rounded-soft bg-surface-low px-3 py-3">
              <p class="font-display text-xl font-bold">{{ summary.count ?? '—' }}</p>
              <p class="text-xs text-muted">cleans</p>
            </div>
            <div class="rounded-soft bg-surface-low px-3 py-3">
              <p class="font-display text-xl font-bold">{{ summary.hours ?? '—' }}</p>
              <p class="text-xs text-muted">hours</p>
            </div>
            <div class="rounded-soft bg-surface-low px-3 py-3">
              <p class="font-display text-xl font-bold">{{ summary.areaM2 ?? '—' }}</p>
              <p class="text-xs text-muted">m²</p>
            </div>
          </div>
        </div>
      </div>

      <p v-if="checked" class="text-xs text-muted">Checked at {{ checked }} · refreshes every {{ POLL_MS / 1000 }} s while this page is open</p>
    </template>
  </PanelCard>
</template>
