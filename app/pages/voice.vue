<script setup lang="ts">
import {
  VOICE_COMMANDS,
  isVoiceMatch,
  matchVoiceCommand,
  type VoiceAction
} from '~~/shared/utils/voice-commands'
import type { SpeechEngine, SpeechLanguage } from '~/composables/useLocalSpeech'

definePageMeta({
  middleware: 'protected'
})

interface LogEntry {
  id: number
  transcript: string
  summary: string
  status: 'done' | 'failed' | 'unmatched'
  detail: string
  at: string
}

const speech = useLocalSpeech()

const engine = ref<SpeechEngine>('browser')
const language = ref<SpeechLanguage>('sl')
const browserSupported = ref(true)
const listening = ref(false)
const transcript = ref('')
const interim = ref('')
const errorMessage = ref('')
const progress = ref(0)
const progressLabel = ref('')
const log = ref<LogEntry[]>([])

let entryId = 0

onMounted(() => {
  browserSupported.value = speech.browserSupported()
  if (!browserSupported.value) {
    engine.value = 'local'
  }
})

onBeforeUnmount(() => {
  if (listening.value) {
    speech.stop(engine.value)
  }
})

function record(entry: Omit<LogEntry, 'id' | 'at'>) {
  log.value.unshift({
    ...entry,
    id: (entryId += 1),
    at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  })
  log.value = log.value.slice(0, 25)
}

async function execute(action: VoiceAction, heard: string) {
  try {
    await $fetch(action.endpoint, { method: 'POST', body: action.body })
    record({ transcript: heard, summary: action.summary, status: 'done', detail: action.endpoint })
  } catch (error) {
    const detail =
      error && typeof error === 'object' && 'data' in error
        ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
        : null
    record({
      transcript: heard,
      summary: action.summary,
      status: 'failed',
      detail: detail || 'The request was rejected.'
    })
  }
}

/** Every command is additive, so a match runs straight away. */
async function run(heard: string) {
  transcript.value = heard
  const result = matchVoiceCommand(heard)

  if (!isVoiceMatch(result)) {
    record({ transcript: heard, summary: '—', status: 'unmatched', detail: result.reason })
    return
  }

  await execute(result.action, heard)
}

function toggle() {
  errorMessage.value = ''

  if (listening.value) {
    speech.stop(engine.value)
    return
  }

  transcript.value = ''
  interim.value = ''
  progress.value = 0
  progressLabel.value = ''

  void speech.start(engine.value, language.value, {
    onInterim: text => {
      interim.value = text
    },
    onResult: text => {
      interim.value = ''
      void run(text)
    },
    onError: message => {
      errorMessage.value = message
    },
    onStateChange: value => {
      listening.value = value
    },
    onProgress: (percent, label) => {
      progress.value = percent
      progressLabel.value = label
    }
  })
}

/** Lets the library be tried without a microphone. */
const typed = ref('')

async function runTyped() {
  const text = typed.value.trim()
  if (!text) {
    return
  }
  typed.value = ''
  await run(text)
}

const STATUS_TONES: Record<LogEntry['status'], 'teal' | 'danger' | 'mist'> = {
  done: 'teal',
  failed: 'danger',
  unmatched: 'mist'
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Hands free"
      title="Voice control"
      subtitle="Say one of the commands below, in Slovenian or English, and it is carried out straight away. Everything it can do adds something — nothing here deletes."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Commands</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ VOICE_COMMANDS.length }}</p>
          <p class="mt-2 text-sm text-muted">{{ log.filter(item => item.status === 'done').length }} run this session</p>
        </PanelCard>
      </template>
    </AppPageHero>

    <p
      v-if="!browserSupported"
      class="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
    >
      This browser has no built-in speech recognition, so the on-device recogniser is selected.
    </p>
    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <PanelCard class="space-y-5">
        <div>
          <p class="eyebrow">Microphone</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
            {{ listening ? 'Listening…' : 'Hold a thought' }}
          </h2>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="eyebrow">Language</span>
            <select
              v-model="language"
              class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              :disabled="listening"
            >
              <option value="sl">Slovenščina</option>
              <option value="en">English</option>
            </select>
          </label>
          <label class="block">
            <span class="eyebrow">Recogniser</span>
            <select
              v-model="engine"
              class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              :disabled="listening"
            >
              <option value="browser" :disabled="!browserSupported">Browser (fast)</option>
              <option value="local">On this device (private)</option>
            </select>
          </label>
        </div>

        <p
          class="rounded-soft px-4 py-3 text-xs leading-5"
          :class="engine === 'local' ? 'bg-emerald-50 text-emerald-900' : 'bg-surface-low text-muted'"
        >
          <template v-if="engine === 'local'">
            Whisper runs in this tab — the audio never leaves your computer. The model is downloaded
            once on first use and then cached; recognition is slower and less accurate than the
            browser's.
          </template>
          <template v-else>
            The browser's own recogniser. Fast and accurate with no download, but it sends the audio to
            Apple or Google to transcribe. Slovenian support here is uneven — switch to on-device if it
            will not listen.
          </template>
        </p>

        <button
          type="button"
          class="flex w-full items-center justify-center gap-3 rounded-full px-6 py-5 text-lg font-semibold transition-colors disabled:opacity-40"
          :class="listening ? 'bg-rose-600 text-white' : 'bg-ink text-white'"
          :disabled="engine === 'browser' && !browserSupported"
          @click="toggle"
        >
          <span
            class="inline-block h-3 w-3 rounded-full"
            :class="listening ? 'animate-pulse bg-white' : 'bg-white/60'"
          />
          {{ listening ? 'Stop and transcribe' : 'Start listening' }}
        </button>

        <div v-if="progressLabel" class="space-y-2">
          <div class="flex items-center justify-between text-sm text-muted">
            <span>{{ progressLabel }}</span>
            <span class="tabular-nums">{{ progress }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-surface-low">
            <div class="h-full rounded-full bg-ink transition-[width] duration-200" :style="{ width: `${progress}%` }" />
          </div>
        </div>

        <div class="rounded-soft bg-surface-low px-5 py-4">
          <p class="eyebrow">Heard</p>
          <p class="mt-2 min-h-[2.5rem] text-sm leading-7 text-ink">
            {{ transcript || interim || '—' }}
            <span v-if="interim" class="text-muted">…</span>
          </p>
        </div>

        <form class="space-y-2" @submit.prevent="runTyped">
          <label class="block">
            <span class="eyebrow">Or type a command</span>
            <input
              v-model="typed"
              class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="text"
              placeholder="Dodaj zapisek servis peči zapade marca"
            />
          </label>
          <button
            class="w-full rounded-full bg-surface-low px-5 py-3 text-sm font-semibold text-ink disabled:opacity-40"
            :disabled="!typed.trim()"
          >
            Run it
          </button>
        </form>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">This session</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">What it did</h2>
        </div>

        <p v-if="!log.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm text-muted">
          Nothing yet. Press Start listening, or type a command.
        </p>

        <div v-else class="space-y-3">
          <article v-for="entry in log" :key="entry.id" class="rounded-soft bg-surface-low px-5 py-4">
            <div class="flex flex-wrap items-center gap-2">
              <StatusPill
                :label="entry.status === 'done' ? 'Done' : entry.status === 'failed' ? 'Failed' : 'Not understood'"
                :tone="STATUS_TONES[entry.status]"
              />
              <span class="text-xs text-muted">{{ entry.at }}</span>
            </div>
            <p class="mt-2 text-sm font-medium text-ink">{{ entry.summary }}</p>
            <p class="mt-1 text-xs italic text-muted">“{{ entry.transcript }}”</p>
            <p v-if="entry.status !== 'done'" class="mt-1 text-xs text-muted">{{ entry.detail }}</p>
          </article>
        </div>
      </PanelCard>
    </div>

    <VoiceAlexaCard />

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">Library</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
          {{ VOICE_COMMANDS.length }} things it understands
        </h2>
        <p class="mt-1 text-sm text-muted">Any of the phrases on the right will start the command.</p>
      </div>

      <div class="space-y-3">
        <article
          v-for="command in VOICE_COMMANDS"
          :key="command.key"
          class="grid gap-3 rounded-soft bg-surface-low px-5 py-4 md:grid-cols-[1fr_1.2fr]"
        >
          <div>
            <p class="font-semibold text-ink">{{ command.label }}</p>
            <p class="mt-1 text-sm italic text-muted">{{ command.example }}</p>
          </div>
          <div class="flex flex-wrap items-start gap-2">
            <span
              v-for="trigger in command.triggers"
              :key="trigger"
              class="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted"
            >
              {{ trigger }}
            </span>
          </div>
        </article>
      </div>
    </PanelCard>
  </div>
</template>
