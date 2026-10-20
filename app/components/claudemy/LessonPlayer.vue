<script setup lang="ts">
import { Pause, Play, RotateCcw } from 'lucide-vue-next'
import type { ClaudemyTurn } from '~~/shared/types/claudemy'
import { spokenLine } from '~~/shared/utils/claudemy-check'

const props = defineProps<{
  script: ClaudemyTurn[]
  words: number
}>()

const emit = defineEmits<{ finished: [] }>()

/**
 * Plays a lesson with two of the browser's own voices, A and B taking turns.
 * Claudemy renders audio with ElevenLabs or macOS `say`; neither exists on a
 * serverless host, and speech synthesis costs nothing and needs no key. Each
 * turn is its own utterance, which keeps long lessons clear of the browser's
 * habit of cutting off a single long utterance.
 */
const VOICE_KEY = 'serene:claudemy-voices'
const RATES = [0.9, 1, 1.15, 1.3]

const supported = ref(true)
const voices = ref<SpeechSynthesisVoice[]>([])
const voiceA = ref('')
const voiceB = ref('')
const rate = ref(1)
const playing = ref(false)
const current = ref(0)
const finished = ref(false)
const lineEls = ref<HTMLElement[]>([])

// Each play bumps this, so callbacks from a cancelled utterance are ignored.
let run = 0

const minutes = computed(() => Math.max(1, Math.round((props.words / 150 / rate.value) * 10) / 10))

function loadVoices() {
  const all = window.speechSynthesis.getVoices()
  const english = all.filter(voice => voice.lang.toLowerCase().startsWith('en'))
  voices.value = english.length ? english : all

  let stored: { a?: string; b?: string } = {}
  try {
    stored = JSON.parse(window.localStorage.getItem(VOICE_KEY) || '{}')
  } catch {
    stored = {}
  }
  const names = voices.value.map(voice => voice.name)
  voiceA.value = stored.a && names.includes(stored.a) ? stored.a : names[0] || ''
  voiceB.value = stored.b && names.includes(stored.b) ? stored.b : names.find(name => name !== voiceA.value) || voiceA.value
}

function saveVoices() {
  try {
    window.localStorage.setItem(VOICE_KEY, JSON.stringify({ a: voiceA.value, b: voiceB.value }))
  } catch {
    // A remembered voice is a convenience; without storage the defaults are used.
  }
}

function voiceFor(speaker: 'A' | 'B') {
  const name = speaker === 'A' ? voiceA.value : voiceB.value
  return voices.value.find(voice => voice.name === name) || null
}

function speakFrom(index: number, token: number) {
  if (token !== run) {
    return
  }
  if (index >= props.script.length) {
    playing.value = false
    current.value = 0
    finished.value = true
    emit('finished')
    return
  }

  current.value = index
  lineEls.value[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })

  const turn = props.script[index]!
  const utterance = new SpeechSynthesisUtterance(spokenLine(turn.text))
  const voice = voiceFor(turn.speaker)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  }
  utterance.rate = rate.value
  // With a single voice available, a small pitch shift still tells the hosts apart.
  if (voiceA.value === voiceB.value) {
    utterance.pitch = turn.speaker === 'A' ? 1 : 0.8
  }
  utterance.onend = () => speakFrom(index + 1, token)
  utterance.onerror = event => {
    if (event.error !== 'interrupted' && event.error !== 'canceled') {
      speakFrom(index + 1, token)
    }
  }
  window.speechSynthesis.speak(utterance)
}

function play(from = current.value) {
  if (!supported.value || !props.script.length) {
    return
  }
  run += 1
  window.speechSynthesis.cancel()
  playing.value = true
  finished.value = false
  speakFrom(from, run)
}

/** Pausing cancels and remembers the turn; the browser's own pause is unreliable. */
function pause() {
  run += 1
  window.speechSynthesis.cancel()
  playing.value = false
}

function restart() {
  pause()
  current.value = 0
  play(0)
}

watch(
  () => props.script,
  () => {
    pause()
    current.value = 0
    finished.value = false
  }
)

watch([voiceA, voiceB], saveVoices)

onMounted(() => {
  supported.value = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  if (!supported.value) {
    return
  }
  loadVoices()
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
})

onBeforeUnmount(() => {
  if (supported.value) {
    pause()
    window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <button
        class="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        :disabled="!supported"
        @click="playing ? pause() : play()"
      >
        <component :is="playing ? Pause : Play" class="h-4 w-4" />
        {{ playing ? 'Pause' : current > 0 ? 'Resume' : 'Listen' }}
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-full bg-surface-low px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
        :disabled="!supported || (!playing && current === 0)"
        @click="restart"
      >
        <RotateCcw class="h-4 w-4" />
        From the top
      </button>
      <span class="text-sm text-muted">about {{ minutes }} min · {{ words }} words</span>
      <span v-if="finished" class="text-sm font-semibold text-teal">Heard ✓</span>
    </div>

    <p v-if="!supported" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      This browser has no speech voices. The script below reads just as well.
    </p>

    <details v-else class="text-sm">
      <summary class="cursor-pointer text-muted hover:text-ink">Voices and speed</summary>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <label class="space-y-1">
          <span class="eyebrow">Host A</span>
          <select v-model="voiceA" class="w-full rounded-xl bg-surface-low px-3 py-2 outline-none">
            <option v-for="voice in voices" :key="voice.name" :value="voice.name">{{ voice.name }}</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="eyebrow">Host B</span>
          <select v-model="voiceB" class="w-full rounded-xl bg-surface-low px-3 py-2 outline-none">
            <option v-for="voice in voices" :key="voice.name" :value="voice.name">{{ voice.name }}</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="eyebrow">Speed</span>
          <select v-model.number="rate" class="w-full rounded-xl bg-surface-low px-3 py-2 outline-none">
            <option v-for="option in RATES" :key="option" :value="option">{{ option }}×</option>
          </select>
        </label>
      </div>
    </details>

    <ol class="max-h-[22rem] space-y-1.5 overflow-y-auto rounded-soft bg-surface-low p-4 text-sm leading-6">
      <li
        v-for="(turn, index) in script"
        :key="index"
        ref="lineEls"
        class="flex cursor-pointer gap-3 rounded-xl px-3 py-1.5 transition-colors"
        :class="playing && index === current ? 'bg-ink text-white' : 'hover:bg-surface'"
        @click="play(index)"
      >
        <span
          class="mt-0.5 shrink-0 text-xs font-bold"
          :class="playing && index === current ? 'text-white/70' : turn.speaker === 'A' ? 'text-accent' : 'text-muted'"
        >
          {{ turn.speaker }}
        </span>
        <span>{{ turn.text }}</span>
      </li>
    </ol>
  </div>
</template>
