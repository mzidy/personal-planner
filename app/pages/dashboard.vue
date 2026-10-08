<script setup lang="ts">
import type { DashboardPayload, UrgencyLevel } from '~~/shared/types/planner'
import type { RoutineDayItem, RoutineOverview, RoutineState } from '~~/shared/types/routine'
import type { StatsOverview } from '~~/shared/types/stats'
import StatsWeightTrendChart from '~/components/stats/WeightTrendChart.vue'

definePageMeta({
  middleware: 'protected'
})

const { data: dashboard } = await usePlannerFetch<DashboardPayload>('dashboard-page', '/api/dashboard')
const { data: routine, refresh: refreshRoutine } = await usePlannerFetch<RoutineOverview>(
  'dashboard-routine',
  '/api/routine/overview'
)
const { data: stats } = await usePlannerFetch<StatsOverview>('dashboard-stats', '/api/stats/overview')

const todayRoutine = computed(() => routine.value?.todayItems || [])

const URGENCY_ORDER: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 }

/** Open work only, most urgent first — the dashboard is a glance, not the full board. */
const openTasks = computed(() =>
  (dashboard.value?.objectives || [])
    .filter(item => item.status !== 'done')
    .sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9))
)

function urgencyTone(urgency: UrgencyLevel) {
  if (urgency === 'critical') return 'danger'
  return urgency === 'high' ? 'ink' : 'mist'
}

function formatDelta(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)} kg`
}

function deltaTone(value: number | null | undefined) {
  if (!value) {
    return 'text-muted'
  }
  return value < 0 ? 'text-emerald-700' : 'text-rose-700'
}

const hoveredId = ref<string | null>(null)
const pendingId = ref<string | null>(null)

/** Clicking toggles between done and planned, so a mis-click is undoable. */
function nextStateFor(state: RoutineState): RoutineState {
  return state === 'done' ? 'planned' : 'done'
}

/** On hover the pill previews the state the click would apply. */
function displayedState(item: RoutineDayItem): RoutineState {
  return hoveredId.value === item.templateId ? nextStateFor(item.state) : item.state
}

async function toggleState(item: RoutineDayItem) {
  if (pendingId.value) {
    return
  }

  pendingId.value = item.templateId

  try {
    await $fetch(`/api/routine/entries/${item.templateId}`, {
      method: 'PATCH',
      body: { state: nextStateFor(item.state) }
    })
    await refreshRoutine()
  } catch {
    // Leave the pill as-is; the routine page is the place to recover.
  } finally {
    pendingId.value = null
  }
}

const ROUTINE_TONES: Record<RoutineState, string> = {
  planned: 'bg-surface text-muted',
  done: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-amber-100 text-amber-800',
  missed: 'bg-rose-100 text-rose-800'
}

const ROUTINE_LABELS: Record<RoutineState, string> = {
  planned: 'Planned',
  done: 'Done',
  partial: 'Partial',
  missed: 'Missed'
}

function routineTone(state: RoutineState) {
  return ROUTINE_TONES[state] || ROUTINE_TONES.planned
}

function routineLabel(state: RoutineState) {
  return ROUTINE_LABELS[state] || state
}
</script>

<template>
  <div v-if="dashboard" class="space-y-8">
    <!--
      Two columns: the greeting and the weight trend on the left, the glance
      cards on the right, so the weight chart sits level with Today instead of
      running the full page width.
    -->
    <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-6">
        <AppPageHero eyebrow="Daily Command" :title="dashboard.greeting" />
        <PanelCard v-if="stats" class="space-y-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p class="eyebrow">Weight</p>
              <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Last 12 weeks</h2>
            </div>
            <div class="flex items-end gap-6">
              <div>
                <p class="eyebrow">Current</p>
                <p class="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">
                  {{ stats.currentWeightKg !== null ? `${stats.currentWeightKg.toFixed(1)} kg` : '—' }}
                </p>
              </div>
              <div>
                <p class="eyebrow">12-week change</p>
                <p
                  class="mt-1 font-display text-2xl font-bold tracking-[-0.04em]"
                  :class="deltaTone(stats.twelveWeekChangeKg)"
                >
                  {{ formatDelta(stats.twelveWeekChangeKg) }}
                </p>
              </div>
            </div>
          </div>

          <StatsWeightTrendChart compact :series="stats.series" :target-weight-kg="stats.profile?.targetWeightKg">
            <template #empty>
              No weigh-ins yet — log one under
              <NuxtLink to="/stats" class="font-semibold text-accent">Personal stats</NuxtLink>
              and the trend appears here.
            </template>
          </StatsWeightTrendChart>
        </PanelCard>
      </div>

      <div class="space-y-6">
        <PanelCard tone="muted">
          <p class="eyebrow">Today</p>
          <p class="mt-3 font-display text-3xl font-bold tracking-[-0.05em]">{{ dashboard.dateLabel }}</p>
          <p class="mt-2 text-sm text-muted">{{ dashboard.agenda.length }} scheduled blocks</p>

          <div v-if="todayRoutine.length" class="mt-4 space-y-2 border-t border-outline/10 pt-4">
            <p class="eyebrow">Daily routine</p>
            <div
              v-for="entry in todayRoutine"
              :key="entry.id"
              class="flex items-center justify-between gap-3"
            >
              <span class="min-w-0 flex-1 truncate text-sm text-ink" :title="entry.description">
                {{ entry.description }}
              </span>
              <button
                type="button"
                class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors disabled:opacity-60"
                :class="routineTone(displayedState(entry))"
                :disabled="pendingId === entry.templateId"
                :title="`Mark as ${routineLabel(nextStateFor(entry.state)).toLowerCase()}`"
                :aria-label="`${entry.description}: mark as ${routineLabel(nextStateFor(entry.state)).toLowerCase()}`"
                @mouseenter="hoveredId = entry.templateId"
                @mouseleave="hoveredId = null"
                @focus="hoveredId = entry.templateId"
                @blur="hoveredId = null"
                @click="toggleState(entry)"
              >
                {{ routineLabel(displayedState(entry)) }}
              </button>
            </div>
          </div>
        </PanelCard>

        <!-- Same muted card style as Today: just what is open, and how urgent. -->
        <PanelCard tone="muted">
          <p class="eyebrow">Tasks</p>
          <p class="mt-3 font-display text-3xl font-bold tracking-[-0.05em]">
            {{ openTasks.length }}<span class="ml-2 text-base font-semibold text-muted">open</span>
          </p>

          <div v-if="openTasks.length" class="mt-4 space-y-2 border-t border-outline/10 pt-4">
            <NuxtLink
              v-for="task in openTasks"
              :key="task.id"
              to="/priorities"
              class="flex items-center justify-between gap-3 rounded-xl px-1 py-0.5 transition-colors hover:bg-surface/60"
            >
              <span class="min-w-0 flex-1 truncate text-sm text-ink" :title="task.title">{{ task.title }}</span>
              <StatusPill :label="task.urgency" :tone="urgencyTone(task.urgency)" />
            </NuxtLink>
          </div>
          <p v-else class="mt-4 border-t border-outline/10 pt-4 text-sm text-muted">
            Nothing open — add one under
            <NuxtLink to="/priorities" class="font-semibold text-accent">Tasks</NuxtLink>.
          </p>
        </PanelCard>
      </div>
    </div>

  </div>
</template>
