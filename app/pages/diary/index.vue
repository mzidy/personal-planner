<script setup lang="ts">
import type { JournalEntryRecord } from '~~/shared/types/planner'
import DiaryCalendar from '~/components/diary/DiaryCalendar.vue'
import DiaryTabs from '~/components/diary/DiaryTabs.vue'

definePageMeta({
  middleware: 'protected'
})

const { longDate } = useExecutiveFormat()
const { data: entries, refresh } = await usePlannerFetch<JournalEntryRecord[]>('diary-page', '/api/journal')

const selectedId = ref<string | null>(entries.value?.[0]?.id || null)

watch(
    entries,
    value => {
      if (!selectedId.value && value?.length) {
        selectedId.value = value[0]?.id || null
      }
    },
  { immediate: true }
)

const selectedEntry = computed(() => (entries.value || []).find(item => item.id === selectedId.value) || null)

const form = reactive({
  title: 'New reflection',
  body: '',
  prompt: 'What should remain simple tomorrow?',
  focusTag: 'Reflection',
  entryDate: ''
})

const errorMessage = ref('')

function formatEntryDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

async function createEntry() {
  errorMessage.value = ''

  try {
    await $fetch('/api/journal', {
      method: 'POST',
      body: {
        title: form.title,
        body: form.body,
        prompt: form.prompt,
        focusTag: form.focusTag,
        entryDate: form.entryDate || null
      }
    })
    form.body = ''
    form.entryDate = ''
    await refresh()
    selectedId.value = entries.value?.[0]?.id || null
  } catch {
    errorMessage.value = 'Unable to save that entry. The body needs at least 10 characters.'
  }
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Timeline"
      title="Diary and reflection"
      subtitle="Keep the private narrative close to the calendar so decisions and emotional load stay legible."
    />

    <DiaryTabs />

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <div class="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Entries</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Recent timeline</h2>
        </div>
        <div class="space-y-3">
          <button
            v-for="entry in entries"
            :key="entry.id"
            class="w-full rounded-soft px-4 py-4 text-left transition"
            :class="entry.id === selectedId ? 'bg-surface text-ink shadow-glass' : 'bg-surface-low text-muted'"
            @click="selectedId = entry.id"
          >
            <div class="flex items-center justify-between gap-4">
              <p class="font-semibold">{{ entry.title }}</p>
              <StatusPill :label="entry.focusTag" tone="teal" />
            </div>
            <p class="mt-2 text-sm">
              <span v-if="entry.entryDate" class="font-semibold text-ink">📅 {{ formatEntryDate(entry.entryDate) }}</span>
              <span v-else>{{ longDate(entry.createdAt) }}</span>
            </p>
          </button>
        </div>
      </PanelCard>

      <div class="grid gap-6">
        <PanelCard v-if="selectedEntry" class="space-y-6">
          <div>
            <p class="eyebrow">Selected Entry</p>
            <h2 class="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">{{ selectedEntry.title }}</h2>
            <p class="mt-2 text-sm text-muted">
              <span v-if="selectedEntry.entryDate" class="font-semibold text-ink">
                📅 {{ formatEntryDate(selectedEntry.entryDate) }}
              </span>
              <span v-else>{{ longDate(selectedEntry.createdAt) }}</span>
            </p>
          </div>
          <div class="rounded-soft bg-surface-low px-5 py-5">
            <p class="eyebrow">Prompt</p>
            <p class="mt-3 text-lg leading-8 text-ink">{{ selectedEntry.prompt }}</p>
          </div>
          <p class="text-base leading-8 text-muted">{{ selectedEntry.body }}</p>
        </PanelCard>

        <PanelCard class="space-y-4">
          <div>
            <p class="eyebrow">New Entry</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Capture a reflection</h2>
          </div>
          <form class="space-y-3" @submit.prevent="createEntry">
            <input v-model="form.title" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" />
            <input v-model="form.prompt" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" />
            <div class="grid gap-3 sm:grid-cols-2">
              <input v-model="form.focusTag" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" />
              <label class="block">
                <input
                  v-model="form.entryDate"
                  class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
                  type="date"
                />
                <span class="mt-1 block px-1 text-xs text-muted">Date (optional) — adds it to the calendar</span>
              </label>
            </div>
            <textarea v-model="form.body" class="min-h-[10rem] w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" />
            <button class="rounded-full bg-ink px-5 py-3 font-semibold text-white">Save entry</button>
          </form>
        </PanelCard>
      </div>
    </div>

    <PanelCard>
      <DiaryCalendar :entries="entries || []" :selected-id="selectedId" @select="selectedId = $event" />
    </PanelCard>
  </div>
</template>
