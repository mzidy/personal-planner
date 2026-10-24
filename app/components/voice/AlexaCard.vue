<script setup lang="ts">
interface AlexaStatus {
  linked: number
  lastUsedAt: string | null
  /** The skill ID is set on the server, so Alexa's requests are accepted. */
  configured: boolean
}

const EXAMPLES = [
  'add milk to my shopping list',
  'add a task call the plumber',
  'take a note the boiler service is due',
  'my weight is eighty four point two',
  'add a diary entry today went well',
  'what is on today'
]

const { data: status, refresh } = await usePlannerFetch<AlexaStatus>('alexa-status', '/api/alexa/status')

const code = ref<{ code: string; expiresAt: string } | null>(null)
const busy = ref(false)
const errorMessage = ref('')
let poll: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (poll) {
    clearInterval(poll)
    poll = null
  }
}

/** The code is said as two groups of three, which Alexa hears most reliably. */
const spoken = computed(() => (code.value ? `${code.value.code.slice(0, 3)} ${code.value.code.slice(3)}` : ''))
const lastUsed = computed(() =>
  status.value?.lastUsedAt ? new Date(status.value.lastUsedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : null
)

async function createCode() {
  busy.value = true
  errorMessage.value = ''
  try {
    code.value = await $fetch<{ code: string; expiresAt: string }>('/api/alexa/link-code', { method: 'POST' })
    const before = status.value?.linked ?? 0
    stopPolling()
    // Watch for the link to land while the code is on screen.
    poll = setInterval(async () => {
      await refresh()
      const linked = (status.value?.linked ?? 0) > before
      const expired = !code.value || Date.parse(code.value.expiresAt) < Date.now()
      if (linked || expired) {
        code.value = null
        stopPolling()
      }
    }, 4000)
  } catch {
    errorMessage.value = 'A link code could not be created.'
  } finally {
    busy.value = false
  }
}

async function unlink() {
  busy.value = true
  errorMessage.value = ''
  try {
    status.value = await $fetch<AlexaStatus>('/api/alexa/links', { method: 'DELETE' })
    code.value = null
    stopPolling()
  } catch {
    errorMessage.value = 'Alexa could not be unlinked.'
  } finally {
    busy.value = false
  }
}

onBeforeUnmount(stopPolling)
</script>

<template>
  <PanelCard class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="eyebrow">Alexa</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
          {{ status?.linked ? 'Linked' : 'Talk to Serene through Alexa' }}
        </h2>
        <p class="mt-1 text-sm text-muted">
          <template v-if="status?.linked">
            {{ status.linked === 1 ? 'One Alexa account adds' : `${status.linked} Alexa accounts add` }} to your planner<template v-if="lastUsed">
              · last used {{ lastUsed }}</template>.
          </template>
          <template v-else>Link your Echo, then say “Alexa, ask serene planner to …”. English only.</template>
        </p>
      </div>
      <div class="flex gap-2">
        <button
          class="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="busy"
          @click="createCode"
        >
          {{ status?.linked ? 'Link another' : 'Link Alexa' }}
        </button>
        <button
          v-if="status?.linked"
          class="rounded-full bg-surface-low px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
          :disabled="busy"
          @click="unlink"
        >
          Unlink
        </button>
      </div>
    </div>

    <p v-if="status && !status.configured" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
      The skill is not connected on the server yet: its skill ID still has to be added to the app's settings.
    </p>
    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</p>

    <div v-if="code" class="rounded-soft bg-surface-low px-5 py-4">
      <p class="text-sm text-muted">Say to your Echo, within ten minutes:</p>
      <p class="mt-2 font-display text-xl font-bold tracking-[-0.03em]">“Alexa, ask serene planner to link {{ spoken }}”</p>
      <p class="mt-2 text-xs text-muted">This page notices when it worked.</p>
    </div>

    <div class="flex flex-wrap gap-2">
      <span v-for="example in EXAMPLES" :key="example" class="rounded-full bg-surface-low px-3 py-1 text-xs font-medium text-muted">
        … {{ example }}
      </span>
    </div>
  </PanelCard>
</template>
