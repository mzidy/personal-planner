<script setup lang="ts">
import type { RoutineDayItem, RoutineOverview, RoutineState } from '~~/shared/types/routine'

definePageMeta({
  middleware: 'protected'
})

const { data: overview, refresh } = await usePlannerFetch<RoutineOverview>('routine-overview', '/api/routine/overview')

const STATES: { value: RoutineState; label: string; tone: string }[] = [
  { value: 'planned', label: 'Planned', tone: 'bg-surface text-muted' },
  { value: 'done', label: 'Done', tone: 'bg-emerald-100 text-emerald-800' },
  { value: 'partial', label: 'Partial', tone: 'bg-amber-100 text-amber-800' },
  { value: 'missed', label: 'Missed', tone: 'bg-rose-100 text-rose-800' }
]

function toneFor(state: RoutineState) {
  return STATES.find(item => item.value === state)?.tone || 'bg-surface text-muted'
}

function labelFor(state: RoutineState) {
  return STATES.find(item => item.value === state)?.label || state
}

const form = reactive({
  description: '',
  entryDate: '',
  state: 'planned' as RoutineState
})

const saving = ref(false)
const errorMessage = ref('')

// The date box is only for logging against a past day; blank means today.
watch(
  overview,
  value => {
    if (value && !form.entryDate) {
      form.entryDate = value.today
    }
  },
  { immediate: true }
)

async function addEntry() {
  const description = form.description.trim()
  if (!description || saving.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/routine/entries', {
      method: 'POST',
      body: {
        description,
        entryDate: form.entryDate || undefined,
        state: form.state
      }
    })
    form.description = ''
    form.state = 'planned'
    await refresh()
  } catch {
    errorMessage.value = 'Unable to save that routine entry.'
  } finally {
    saving.value = false
  }
}

async function setState(entry: RoutineDayItem, state: RoutineState) {
  if (entry.state === state) {
    return
  }

  errorMessage.value = ''

  try {
    await $fetch(`/api/routine/entries/${entry.templateId}`, { method: 'PATCH', body: { state } })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to update that entry.'
  }
}

async function moveEntry(entry: RoutineDayItem, direction: 'up' | 'down') {
  errorMessage.value = ''

  try {
    await $fetch(`/api/routine/entries/${entry.templateId}/move`, { method: 'POST', body: { direction } })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to reorder that entry.'
  }
}

async function deleteEntry(entry: RoutineDayItem) {
  errorMessage.value = ''

  try {
    await $fetch(`/api/routine/entries/${entry.templateId}`, { method: 'DELETE' })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to delete that entry.'
  }
}

const pastDays = computed(() => (overview.value?.history || []).filter(day => !day.isToday))
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <AppPageHero
      eyebrow="Rhythm"
      title="Daily routine"
      subtitle="Your routine repeats every day. Mark how each item went; the history below keeps a record per day."
    />

    <div class="flex flex-wrap items-center gap-2">
      <NuxtLink to="/priorities" class="rounded-full bg-surface-low px-4 py-2 text-sm font-semibold text-ink hover:bg-surface">
        Overview
      </NuxtLink>
      <NuxtLink to="/priorities/routine" class="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
        Daily routine
      </NuxtLink>
    </div>

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">Today</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
          {{ new Date(`${overview.today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }}
        </h2>
      </div>

      <p v-if="!overview.todayItems.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm text-muted">
        No routine items yet — add your first one below. Items you add appear every day.
      </p>

      <div v-else class="space-y-3">
        <article
          v-for="(entry, index) in overview.todayItems"
          :key="entry.id"
          class="rounded-soft bg-surface-low px-5 py-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <p class="min-w-0 flex-1 leading-7 text-ink" :class="entry.state === 'done' ? 'line-through opacity-70' : ''">
              {{ entry.description }}
            </p>
            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="rounded-full bg-surface px-2 py-1 text-xs font-semibold text-ink disabled:opacity-30"
                :disabled="index === 0"
                aria-label="Move up"
                title="Move up"
                @click="moveEntry(entry, 'up')"
              >
                ↑
              </button>
              <button
                type="button"
                class="rounded-full bg-surface px-2 py-1 text-xs font-semibold text-ink disabled:opacity-30"
                :disabled="index === overview.todayItems.length - 1"
                aria-label="Move down"
                title="Move down"
                @click="moveEntry(entry, 'down')"
              >
                ↓
              </button>
              <button class="ml-2 text-xs font-semibold text-rose-700" @click="deleteEntry(entry)">Delete</button>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button
              v-for="state in STATES"
              :key="state.value"
              type="button"
              class="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
              :class="entry.state === state.value ? state.tone : 'bg-surface text-muted hover:text-ink'"
              @click="setState(entry, state.value)"
            >
              {{ state.label }}
            </button>
          </div>
        </article>
      </div>
    </PanelCard>

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">History</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Past days</h2>
      </div>

      <p v-if="!pastDays.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm text-muted">
        No history yet. Days you mark a state on show up here.
      </p>

      <div v-else class="space-y-4">
        <div v-for="day in pastDays" :key="day.entryDate" class="rounded-soft bg-surface-low px-5 py-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-semibold text-ink">{{ day.label }}</p>
            <p class="text-sm text-muted">{{ day.doneCount }} / {{ day.totalCount }} done</p>
          </div>
          <div class="mt-3 space-y-2">
            <div
              v-for="entry in day.items"
              :key="entry.id"
              class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-2"
            >
              <p class="min-w-0 flex-1 text-sm leading-6 text-ink">{{ entry.description }}</p>
              <span class="shrink-0 rounded-full px-3 py-1 text-xs font-semibold" :class="toneFor(entry.state)">
                {{ labelFor(entry.state) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </PanelCard>

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">New Entry</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Add to the routine.</h2>
      </div>
      <form class="space-y-3" @submit.prevent="addEntry">
        <input
          v-model="form.description"
          class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
          type="text"
          placeholder="Describe the routine, e.g. 30 minutes of reading before work"
          required
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="eyebrow">Date</span>
            <input
              v-model="form.entryDate"
              class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="date"
            />
            <span class="mt-1 block px-1 text-xs text-muted">Defaults to today; set it back to log history.</span>
          </label>
          <label class="block">
            <span class="eyebrow">State</span>
            <select v-model="form.state" class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
              <option v-for="state in STATES" :key="state.value" :value="state.value">{{ state.label }}</option>
            </select>
          </label>
        </div>
        <button
          class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
          :disabled="saving || !form.description.trim()"
        >
          Add entry
        </button>
      </form>
    </PanelCard>
  </div>
</template>
