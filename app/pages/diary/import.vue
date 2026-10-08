<script setup lang="ts">
import type { NoteRecord } from '~~/shared/types/notes'
import { detectTable, linesFromBlocks, tableToText } from '~~/shared/utils/ocr-table'
import DiaryTabs from '~/components/diary/DiaryTabs.vue'

definePageMeta({
  middleware: 'protected'
})

const MAX_BYTES = 12 * 1024 * 1024

const fileName = ref('')
const previewUrl = ref('')
const extracted = ref('')
const tableRows = ref<string[][] | null>(null)
const tableReason = ref('')
/** Keep the grid, or save the text as it came out. */
const keepTable = ref(true)
const progress = ref(0)
const stage = ref('')
const reading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const savedMessage = ref('')

const canSave = computed(() => Boolean(extracted.value.trim()) && !reading.value && !saving.value)

/** Object URLs are only freed here; the image itself never leaves the browser. */
function releasePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

onBeforeUnmount(releasePreview)

function reset() {
  releasePreview()
  fileName.value = ''
  extracted.value = ''
  tableRows.value = null
  tableReason.value = ''
  keepTable.value = true
  progress.value = 0
  stage.value = ''
  errorMessage.value = ''
  savedMessage.value = ''
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  reset()

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'That is not an image.'
    input.value = ''
    return
  }

  if (file.size > MAX_BYTES) {
    errorMessage.value = 'That image is over 12 MB. Try a smaller one.'
    input.value = ''
    return
  }

  fileName.value = file.name
  previewUrl.value = URL.createObjectURL(file)
  await readText(file)

  // Let the same file be picked again after a reset.
  input.value = ''
}

async function readText(file: File) {
  reading.value = true
  progress.value = 0
  stage.value = 'Loading the recogniser'

  try {
    /*
     * Imported where it is used, not at the top of the module: tesseract.js
     * needs a browser (Web Workers, WASM) and must never be pulled into the
     * server render. The first run fetches the engine and the English model,
     * which is why progress is surfaced rather than leaving a frozen button.
     */
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng', 1, {
      logger: message => {
        if (typeof message.progress === 'number') {
          progress.value = Math.round(message.progress * 100)
        }
        if (message.status) {
          stage.value = message.status.replace(/^\w/, character => character.toUpperCase())
        }
      }
    })

    try {
      // `blocks` carries the per-word bounding boxes the table detection needs;
      // the plain text alone has no positions in it.
      const result = await worker.recognize(file, {}, { text: true, blocks: true })
      const detection = detectTable(linesFromBlocks(result.data.blocks))

      if (detection.isTable) {
        tableRows.value = detection.rows
        extracted.value = tableToText(detection.rows)
      } else {
        tableRows.value = null
        extracted.value = result.data.text.trim()
      }
      tableReason.value = detection.reason

      if (!extracted.value) {
        errorMessage.value = 'No text was found in that image.'
      }
    } finally {
      await worker.terminate()
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? `Could not read that image: ${error.message}` : 'Could not read that image.'
  } finally {
    reading.value = false
    stage.value = ''
  }
}

async function saveNote() {
  if (!canSave.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''
  savedMessage.value = ''

  try {
    const note = await $fetch<NoteRecord>('/api/notes', {
      method: 'POST',
      body: {
        body: extracted.value.trim(),
        source: 'import',
        sourceName: fileName.value,
        tableRows: keepTable.value ? tableRows.value : null
      }
    })

    const stamp = new Date(note.createdAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // reset() clears the messages too, so the confirmation is set after it.
    reset()
    savedMessage.value = `Saved ${stamp}.`
  } catch (error) {
    const detail =
      error && typeof error === 'object' && 'data' in error
        ? (error as { data?: { statusMessage?: string; message?: string } }).data
        : null
    errorMessage.value = detail?.statusMessage || detail?.message || 'That note could not be saved.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Notes"
      title="Import from an image"
      subtitle="Pick a photo or screenshot and the text is read out of it here, in your browser. Only the text is saved."
    />

    <DiaryTabs />

    <div class="grid gap-6 xl:grid-cols-2">
      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Image</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Pick a file</h2>
          <p class="mt-1 text-sm leading-6 text-muted">
            The image is never uploaded and is not stored — it is read locally and discarded when you
            leave this page.
          </p>
        </div>

        <label class="block">
          <span class="eyebrow">Image file</span>
          <input
            class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 text-sm outline-none file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            type="file"
            accept="image/*"
            :disabled="reading"
            @change="handleFile"
          />
        </label>

        <div v-if="previewUrl" class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <p class="eyebrow">Preview</p>
            <button type="button" class="text-xs font-semibold text-muted hover:text-ink" @click="reset">
              Clear
            </button>
          </div>
          <div class="overflow-hidden rounded-soft bg-surface-low">
            <img :src="previewUrl" :alt="fileName" class="max-h-[22rem] w-full object-contain" />
          </div>
          <p class="truncate text-xs text-muted" :title="fileName">{{ fileName }}</p>
        </div>

        <div v-if="reading" class="space-y-2">
          <div class="flex items-center justify-between text-sm text-muted">
            <span>{{ stage || 'Reading' }}</span>
            <span class="tabular-nums">{{ progress }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-surface-low">
            <div class="h-full rounded-full bg-ink transition-[width] duration-200" :style="{ width: `${progress}%` }" />
          </div>
          <p class="text-xs leading-5 text-muted">
            The first run downloads the recogniser and its English model, so it takes longer than later
            ones.
          </p>
        </div>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Extracted text</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Check it, then save</h2>
          <p class="mt-1 text-sm text-muted">Recognition is rarely perfect — check it before saving.</p>
        </div>

        <div v-if="tableRows" class="space-y-3">
          <label class="flex items-center gap-3 rounded-2xl bg-surface-low px-4 py-3">
            <input v-model="keepTable" class="h-4 w-4 accent-black" type="checkbox" />
            <span class="text-sm font-semibold text-ink">Keep it as a table</span>
            <span class="text-xs text-muted">{{ tableReason }}</span>
          </label>

          <div v-if="keepTable" class="overflow-x-auto rounded-2xl bg-surface-low">
            <table class="w-full min-w-[22rem] text-sm">
              <tbody>
                <tr v-for="(row, rowIndex) in tableRows" :key="rowIndex" class="border-b border-outline/10 last:border-0">
                  <td
                    v-for="(cell, cellIndex) in row"
                    :key="cellIndex"
                    class="px-3 py-2 align-top"
                    :class="rowIndex === 0 ? 'font-semibold text-ink' : 'text-muted'"
                  >
                    {{ cell }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p v-else-if="tableReason" class="text-xs text-muted">{{ tableReason }}</p>

        <textarea
          v-show="!tableRows || !keepTable"
          v-model="extracted"
          class="min-h-[18rem] w-full rounded-2xl bg-surface-low px-4 py-3 font-mono text-sm leading-6 outline-none"
          placeholder="Text read from the image appears here."
          :disabled="reading"
        />

        <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {{ errorMessage }}
        </p>
        <p v-else-if="savedMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {{ savedMessage }}
          <NuxtLink to="/diary/notes" class="font-semibold underline">See it in Notes</NuxtLink>.
        </p>

        <button
          class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
          :disabled="!canSave"
          @click="saveNote"
        >
          {{ saving ? 'Saving…' : 'Save as note' }}
        </button>
      </PanelCard>
    </div>
  </div>
</template>
