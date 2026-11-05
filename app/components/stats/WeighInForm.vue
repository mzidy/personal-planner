<script setup lang="ts">
import type { WeighInRecord } from '~~/shared/types/stats'
import {
  formatWeek,
  isPlausibleWeight,
  localNoonIso,
  parseWeight,
  todayIso,
  weighInWeek
} from '~~/shared/utils/weigh-in'

const props = defineProps<{ history: WeighInRecord[] }>()
const emit = defineEmits<{ saved: [] }>()

// A model because the heading lives with the parent (a card or a dialog) and
// depends on the week this date falls in.
const date = defineModel<string>('date', { required: true })

const weightInput = ref('')
// v-model on a number input yields a number once filled in and '' when empty.
const bodyFatInput = ref<number | ''>('')
const notesInput = ref('')
const saving = ref(false)
const errorMessage = ref('')

const week = computed(() => weighInWeek(date.value, props.history))
const weightValue = computed(() => parseWeight(weightInput.value))
const canSave = computed(() => isPlausibleWeight(weightValue.value) && Boolean(localNoonIso(date.value)))

async function save() {
  if (!canSave.value || saving.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/stats/weigh-ins', {
      method: 'POST',
      body: {
        weightKg: weightValue.value,
        bodyFatPercent: bodyFatInput.value === '' ? null : bodyFatInput.value,
        notes: notesInput.value.trim(),
        measuredAt: localNoonIso(date.value)
      }
    })
    weightInput.value = ''
    bodyFatInput.value = ''
    notesInput.value = ''
    date.value = todayIso()
    emit('saved')
  } catch {
    errorMessage.value = 'Unable to save this weigh-in. Weight must be between 25 and 400 kg.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted">
      <template v-if="week.weekKey">
        Week of {{ formatWeek(week.weekKey) }}. One entry per week —
        {{ week.logged ? 'saving replaces the one already there.' : 'this will be its first.' }}
      </template>
      <template v-else>Pick a date.</template>
    </p>
    <form class="space-y-3" @submit.prevent="save">
      <label class="block">
        <span class="eyebrow">Date</span>
        <input
          v-model="date"
          class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
          type="date"
          required
        />
      </label>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="eyebrow">Weight (kg)</span>
          <input
            v-model="weightInput"
            class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="text"
            inputmode="decimal"
            placeholder="82.4"
            required
          />
        </label>
        <label class="block">
          <span class="eyebrow">Body fat % (optional)</span>
          <input
            v-model="bodyFatInput"
            class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="number"
            step="0.1"
            min="2"
            max="70"
            placeholder="18.5"
          />
        </label>
      </div>
      <input
        v-model="notesInput"
        class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
        type="text"
        placeholder="Optional note, e.g. after travel week"
      />

      <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
        {{ errorMessage }}
      </p>

      <button
        class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
        :disabled="saving || !canSave"
      >
        {{ week.logged ? 'Update weigh-in' : 'Save weigh-in' }}
      </button>
    </form>
  </div>
</template>
