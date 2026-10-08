<script setup lang="ts">
import type { NoteRecord, NotesPayload } from '~~/shared/types/notes'
import DiaryTabs from '~/components/diary/DiaryTabs.vue'

definePageMeta({
  middleware: 'protected'
})

const { data: payload, refresh } = await usePlannerFetch<NotesPayload>('diary-notes', '/api/notes')

const draft = ref('')
const saving = ref(false)
const errorMessage = ref('')
const expandedId = ref<string | null>(null)
const pendingDeleteId = ref<string | null>(null)

let disarmTimer: ReturnType<typeof setTimeout> | null = null

const notes = computed(() => payload.value?.notes || [])

async function addNote() {
  const body = draft.value.trim()
  if (!body || saving.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/notes', { method: 'POST', body: { body, source: 'manual' } })
    draft.value = ''
    await refresh()
  } catch {
    errorMessage.value = 'That note could not be saved.'
  } finally {
    saving.value = false
  }
}

/** Two-step delete, same as objectives: the first click only arms the button. */
function disarmDelete() {
  if (disarmTimer) clearTimeout(disarmTimer)
  pendingDeleteId.value = null
}

onBeforeUnmount(disarmDelete)

async function deleteNote(note: NoteRecord) {
  if (pendingDeleteId.value !== note.id) {
    pendingDeleteId.value = note.id
    if (disarmTimer) clearTimeout(disarmTimer)
    disarmTimer = setTimeout(() => {
      pendingDeleteId.value = null
    }, 4000)
    return
  }

  disarmDelete()
  errorMessage.value = ''

  try {
    await $fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to delete that note.'
  }
}

function stamp(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Enough of a note to recognise it without opening it. */
function preview(body: string) {
  const firstLine = body.split('\n').find(line => line.trim()) || ''
  return firstLine.length > 90 ? `${firstLine.slice(0, 90)}…` : firstLine
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Notes"
      title="Everything you have captured"
      subtitle="Typed here or read out of an image, each note is kept with the date and time it was saved."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Saved</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ notes.length }}</p>
          <p class="mt-2 text-sm text-muted">
            {{ notes.filter(note => note.source === 'import').length }} from images
          </p>
        </PanelCard>
      </template>
    </AppPageHero>

    <DiaryTabs />

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">New note</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Write one</h2>
      </div>
      <form class="space-y-3" @submit.prevent="addNote">
        <textarea
          v-model="draft"
          class="min-h-[8rem] w-full rounded-2xl bg-surface-low px-4 py-3 leading-7 outline-none"
          placeholder="Anything worth keeping."
        />
        <button
          class="rounded-full bg-ink px-6 py-3 font-semibold text-white disabled:opacity-50"
          :disabled="saving || !draft.trim()"
        >
          {{ saving ? 'Saving…' : 'Save note' }}
        </button>
      </form>
    </PanelCard>

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">Saved notes</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
          {{ notes.length }} {{ notes.length === 1 ? 'note' : 'notes' }}
        </h2>
      </div>

      <p v-if="!notes.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm leading-6 text-muted">
        Nothing yet — write one above, or
        <NuxtLink to="/diary/import" class="font-semibold text-accent">import from an image</NuxtLink>.
      </p>

      <div v-else class="space-y-3">
        <article v-for="note in notes" :key="note.id" class="rounded-soft bg-surface-low px-5 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="expandedId = expandedId === note.id ? null : note.id"
            >
              <div class="flex flex-wrap items-center gap-2">
                <StatusPill
                  :label="note.source === 'import' ? 'Image' : 'Typed'"
                  :tone="note.source === 'import' ? 'teal' : 'mist'"
                />
                <span class="text-sm text-muted">{{ stamp(note.createdAt) }}</span>
                <span v-if="note.sourceName" class="truncate text-xs text-muted" :title="note.sourceName">
                  {{ note.sourceName }}
                </span>
              </div>
              <p v-if="expandedId !== note.id" class="mt-2 truncate text-sm text-ink">
                {{ preview(note.body) }}
              </p>
            </button>
            <div class="flex shrink-0 items-center gap-3">
              <button
                type="button"
                class="text-xs font-semibold text-ink"
                @click="expandedId = expandedId === note.id ? null : note.id"
              >
                {{ expandedId === note.id ? 'Hide' : 'Open' }}
              </button>
              <button
                type="button"
                class="text-xs font-semibold transition-colors"
                :class="pendingDeleteId === note.id ? 'text-rose-700' : 'text-muted hover:text-rose-700'"
                @click="deleteNote(note)"
                @blur="pendingDeleteId === note.id && disarmDelete()"
              >
                {{ pendingDeleteId === note.id ? 'Confirm?' : 'Delete' }}
              </button>
            </div>
          </div>

          <p
            v-if="expandedId === note.id"
            class="mt-3 whitespace-pre-wrap border-t border-outline/10 pt-3 text-sm leading-7 text-ink"
          >{{ note.body }}</p>
        </article>
      </div>
    </PanelCard>
  </div>
</template>
