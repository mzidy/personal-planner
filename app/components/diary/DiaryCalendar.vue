<script setup lang="ts">
import {
  addMonths,
  eachDayOfInterval,
  endOfISOWeek,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfISOWeek,
  startOfMonth,
  subMonths
} from 'date-fns'
import type { JournalEntryRecord } from '~~/shared/types/planner'

const props = defineProps<{
  entries: JournalEntryRecord[]
  selectedId?: string | null
}>()

const emit = defineEmits<{ select: [entryId: string] }>()

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const cursor = ref(startOfMonth(new Date()))
const selectedDay = ref<string | null>(null)

/** Entries that carry a calendar date, bucketed by YYYY-MM-DD. */
const entriesByDay = computed(() => {
  const map = new Map<string, JournalEntryRecord[]>()

  for (const entry of props.entries) {
    if (!entry.entryDate) {
      continue
    }
    const bucket = map.get(entry.entryDate)
    if (bucket) {
      bucket.push(entry)
    } else {
      map.set(entry.entryDate, [entry])
    }
  }

  return map
})

const datedCount = computed(() => props.entries.filter(entry => entry.entryDate).length)

const days = computed(() => {
  const gridStart = startOfISOWeek(startOfMonth(cursor.value))
  const gridEnd = endOfISOWeek(endOfMonth(cursor.value))

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map(date => {
    const key = format(date, 'yyyy-MM-dd')
    const dayEntries = entriesByDay.value.get(key) || []

    return {
      key,
      label: format(date, 'd'),
      inMonth: isSameMonth(date, cursor.value),
      isToday: isToday(date),
      entries: dayEntries,
      hasEntries: dayEntries.length > 0
    }
  })
})

const monthLabel = computed(() => format(cursor.value, 'MMMM yyyy'))

const selectedDayEntries = computed(() =>
  selectedDay.value ? entriesByDay.value.get(selectedDay.value) || [] : []
)

const selectedDayLabel = computed(() =>
  selectedDay.value ? format(parseISO(selectedDay.value), 'EEEE, MMMM d') : ''
)

function shiftMonth(amount: number) {
  cursor.value = amount > 0 ? addMonths(cursor.value, amount) : subMonths(cursor.value, Math.abs(amount))
}

function goToToday() {
  cursor.value = startOfMonth(new Date())
}

function pickDay(day: { key: string; entries: JournalEntryRecord[] }) {
  if (!day.entries.length) {
    selectedDay.value = null
    return
  }

  selectedDay.value = day.key
  emit('select', day.entries[0]!.id)
}

/** Jump the calendar to whichever month a newly selected entry lives in. */
watch(
  () => props.selectedId,
  id => {
    const entry = props.entries.find(item => item.id === id)
    if (entry?.entryDate) {
      cursor.value = startOfMonth(parseISO(entry.entryDate))
      selectedDay.value = entry.entryDate
    }
  }
)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="eyebrow">Calendar</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ monthLabel }}</h2>
        <p class="mt-1 text-sm text-muted">
          {{ datedCount }} {{ datedCount === 1 ? 'entry has' : 'entries have' }} a date
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="rounded-full bg-surface-low px-3 py-2 text-sm font-semibold text-ink"
          type="button"
          aria-label="Previous month"
          @click="shiftMonth(-1)"
        >
          ‹
        </button>
        <button
          class="rounded-full bg-surface-low px-4 py-2 text-sm font-semibold text-ink"
          type="button"
          @click="goToToday"
        >
          Today
        </button>
        <button
          class="rounded-full bg-surface-low px-3 py-2 text-sm font-semibold text-ink"
          type="button"
          aria-label="Next month"
          @click="shiftMonth(1)"
        >
          ›
        </button>
      </div>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center">
      <p v-for="weekday in WEEKDAYS" :key="weekday" class="eyebrow py-2">{{ weekday }}</p>

      <button
        v-for="day in days"
        :key="day.key"
        type="button"
        class="relative flex aspect-square flex-col items-center justify-center rounded-soft text-sm transition-colors"
        :class="[
          day.hasEntries ? 'bg-ink font-semibold text-white' : 'bg-surface-low',
          !day.inMonth && !day.hasEntries ? 'text-muted/50' : '',
          !day.inMonth && day.hasEntries ? 'opacity-60' : '',
          day.inMonth && !day.hasEntries ? 'text-ink' : '',
          selectedDay === day.key ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : '',
          day.hasEntries ? 'cursor-pointer' : 'cursor-default'
        ]"
        :disabled="!day.hasEntries"
        @click="pickDay(day)"
      >
        <span :class="day.isToday && !day.hasEntries ? 'rounded-full bg-accent/15 px-2 py-0.5 text-accent' : ''">
          {{ day.label }}
        </span>
        <span v-if="day.entries.length > 1" class="mt-0.5 text-[10px] font-semibold text-white/70">
          {{ day.entries.length }} entries
        </span>
        <span
          v-else-if="day.isToday && day.hasEntries"
          class="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70"
        >
          Today
        </span>
      </button>
    </div>

    <div v-if="selectedDayEntries.length" class="space-y-2 rounded-soft bg-surface-low px-4 py-4">
      <p class="eyebrow">{{ selectedDayLabel }}</p>
      <button
        v-for="entry in selectedDayEntries"
        :key="entry.id"
        type="button"
        class="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition-colors"
        :class="entry.id === selectedId ? 'bg-surface text-ink' : 'text-muted hover:bg-surface'"
        @click="emit('select', entry.id)"
      >
        <span class="font-semibold text-ink">{{ entry.title }}</span>
        <UiStatusPill :label="entry.focusTag" tone="teal" />
      </button>
    </div>

    <p v-else-if="!datedCount" class="rounded-soft bg-surface-low px-4 py-6 text-center text-sm text-muted">
      No dated reflections yet. Add a date when saving an entry and it will appear here.
    </p>

    <p v-else class="text-center text-sm text-muted">Select a highlighted day to open its reflection.</p>
  </div>
</template>
