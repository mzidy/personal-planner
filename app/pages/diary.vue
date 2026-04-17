<script setup lang="ts">
import type { JournalEntryRecord } from '~~/shared/types/planner'

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
  focusTag: 'Reflection'
})

async function createEntry() {
  await $fetch('/api/journal', {
    method: 'POST',
    body: form
  })
  form.body = ''
  await refresh()
  selectedId.value = entries.value?.[0]?.id || null
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Timeline"
      title="Diary and reflection"
      subtitle="Keep the private narrative close to the calendar so decisions and emotional load stay legible."
    />

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
            <p class="mt-2 text-sm">{{ longDate(entry.createdAt) }}</p>
          </button>
        </div>
      </PanelCard>

      <div class="grid gap-6">
        <PanelCard v-if="selectedEntry" class="space-y-6">
          <div>
            <p class="eyebrow">Selected Entry</p>
            <h2 class="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">{{ selectedEntry.title }}</h2>
            <p class="mt-2 text-sm text-muted">{{ longDate(selectedEntry.createdAt) }}</p>
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
            <input v-model="form.focusTag" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" />
            <textarea v-model="form.body" class="min-h-[10rem] w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" />
            <button class="rounded-full bg-ink px-5 py-3 font-semibold text-white">Save entry</button>
          </form>
        </PanelCard>
      </div>
    </div>
  </div>
</template>
