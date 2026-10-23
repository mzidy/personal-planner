<script setup lang="ts">
import type { UrgencyLevel } from '~~/shared/types/planner'

const {
  stats,
  greeting,
  today,
  blocksToday,
  tasksByUrgency,
  criticalCount,
  routineItems,
  routineDone,
  pendingRoutine,
  toggleRoutine,
  weighIn,
  weighInValid,
  weighInError,
  savingWeighIn,
  saveWeighIn
} = await useHome()

const dateLine = computed(() =>
  new Date(`${today.value}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
)
const routineDate = computed(() => new Date(`${today.value}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))

const URGENCY: Record<UrgencyLevel, { dot: string; text: string }> = {
  critical: { dot: 'bg-[#F87171]', text: 'text-[#F87171]' },
  high: { dot: 'bg-[#FBBF24]', text: 'text-[#FBBF24]' },
  medium: { dot: 'bg-[#38D5F0]', text: 'text-[#9AA1AC]' },
  low: { dot: 'bg-[#6B7280]', text: 'text-[#9AA1AC]' }
}

const change = computed(() => stats.value?.twelveWeekChangeKg ?? null)
const tile = 'flex flex-col gap-1.5 rounded-xl border border-[#2B2F36] bg-[#1E2126] px-5 py-[18px]'
const card = 'flex flex-col gap-4 rounded-xl border border-[#2B2F36] bg-[#1E2126] p-6'
const label = 'text-[11px] uppercase tracking-[0.14em] text-[#9AA1AC]'
</script>

<template>
  <div class="flex flex-col gap-6 text-[#E8EAEE]">
    <section class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1.5">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#38D5F0]">Daily Command</p>
        <h1 class="font-display text-[32px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[40px]">{{ greeting }}</h1>
      </div>
      <p class="tabular-nums text-[#9AA1AC]">{{ dateLine }} · {{ blocksToday }} scheduled {{ blocksToday === 1 ? 'block' : 'blocks' }}</p>
    </section>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
      <div :class="tile">
        <p :class="label">Weight</p>
        <p class="font-display text-[30px] font-bold tabular-nums">
          {{ stats?.currentWeightKg != null ? stats.currentWeightKg.toFixed(1) : '—' }} <span class="text-sm text-[#9AA1AC]">kg</span>
        </p>
      </div>
      <div :class="tile">
        <p :class="label">12-week change</p>
        <p class="font-display text-[30px] font-bold tabular-nums" :class="change === null ? '' : change <= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'">
          {{ change === null ? '—' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change).toFixed(1)}` }}
          <span class="text-sm text-[#9AA1AC]">kg</span>
        </p>
      </div>
      <div :class="tile">
        <p :class="label">Open tasks</p>
        <p class="font-display text-[30px] font-bold tabular-nums">
          {{ tasksByUrgency.length }}
          <span v-if="criticalCount" class="text-sm text-[#F87171]">{{ criticalCount }} critical</span>
        </p>
      </div>
      <div :class="tile">
        <p :class="label">Routine today</p>
        <p class="font-display text-[30px] font-bold tabular-nums">{{ routineDone }}<span class="text-[#9AA1AC]">/{{ routineItems.length }}</span></p>
      </div>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] items-start gap-4">
      <section :class="card">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-display text-lg font-semibold">Weight · last 12 weeks</h2>
          <span v-if="stats?.profile?.targetWeightKg" class="text-xs text-[#9AA1AC]">target {{ stats.profile.targetWeightKg }} kg</span>
        </div>
        <HomeWeightLine :series="stats?.series || []" :target="stats?.profile?.targetWeightKg" variant="graphite">
          <template #empty>No weigh-ins yet — log one below and the trend appears here.</template>
        </HomeWeightLine>
        <form class="flex flex-wrap items-end gap-2.5 border-t border-[#2B2F36] pt-4" @submit.prevent="saveWeighIn">
          <label class="flex flex-[1_1_140px] flex-col gap-1.5">
            <span :class="label">Weigh-in date</span>
            <input v-model="weighIn.date" type="date" class="rounded-lg border border-[#2B2F36] bg-[#15171B] px-3 py-2.5 text-[#E8EAEE] outline-none" />
          </label>
          <label class="flex flex-[1_1_120px] flex-col gap-1.5">
            <span :class="label">Weight (kg)</span>
            <input
              v-model="weighIn.weight"
              type="text"
              inputmode="decimal"
              :placeholder="stats?.currentWeightKg != null ? stats.currentWeightKg.toFixed(1) : '84.0'"
              class="rounded-lg border border-[#2B2F36] bg-[#15171B] px-3 py-2.5 text-[#E8EAEE] outline-none"
            />
          </label>
          <button class="rounded-lg bg-[#38D5F0] px-[18px] py-[11px] font-semibold text-[#15171B] disabled:opacity-40" :disabled="!weighInValid || savingWeighIn">
            {{ savingWeighIn ? 'Saving…' : 'Save' }}
          </button>
          <p v-if="weighInError" class="basis-full text-xs text-[#F87171]">{{ weighInError }}</p>
        </form>
      </section>

      <div class="flex flex-col gap-4">
        <section class="flex flex-col gap-3 rounded-xl border border-[#2B2F36] bg-[#1E2126] p-6">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg font-semibold">Daily routine</h2>
            <span class="text-xs text-[#9AA1AC]">{{ routineDate }}</span>
          </div>
          <div v-if="routineItems.length" class="flex flex-col">
            <div
              v-for="(item, index) in routineItems"
              :key="item.id"
              class="flex items-center justify-between gap-3 py-2.5"
              :class="{ 'border-b border-[#2B2F36]': index < routineItems.length - 1 }"
            >
              <span class="min-w-0 truncate">{{ item.description }}</span>
              <button
                type="button"
                class="shrink-0 rounded px-2.5 py-[3px] text-[11px] font-semibold uppercase transition disabled:opacity-50"
                :class="item.state === 'done' ? 'bg-[#4ADE80]/15 text-[#4ADE80]' : 'border border-[#2B2F36] text-[#9AA1AC] hover:text-[#E8EAEE]'"
                :disabled="pendingRoutine === item.templateId"
                :title="item.state === 'done' ? 'Mark as planned' : 'Mark as done'"
                @click="toggleRoutine(item)"
              >
                {{ item.state === 'done' ? 'Done' : 'Planned' }}
              </button>
            </div>
          </div>
          <p v-else class="text-sm text-[#9AA1AC]">
            No routine yet — set one up under <NuxtLink to="/priorities/routine" class="font-semibold text-[#38D5F0]">Daily routine</NuxtLink>.
          </p>
        </section>

        <section class="flex flex-col gap-3 rounded-xl border border-[#2B2F36] bg-[#1E2126] p-6">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg font-semibold">Open tasks</h2>
            <NuxtLink to="/priorities" class="text-xs font-semibold text-[#38D5F0] hover:text-[#7FE5F7]">View board →</NuxtLink>
          </div>
          <div v-if="tasksByUrgency.length" class="flex flex-col">
            <NuxtLink
              v-for="(task, index) in tasksByUrgency.slice(0, 6)"
              :key="task.id"
              to="/priorities"
              class="flex items-center justify-between gap-3 py-2.5 text-[#E8EAEE]"
              :class="{ 'border-b border-[#2B2F36]': index < Math.min(tasksByUrgency.length, 6) - 1 }"
            >
              <span class="flex min-w-0 items-center gap-2.5">
                <span class="h-2 w-2 shrink-0 rounded-sm" :class="URGENCY[task.urgency].dot" />
                <span class="truncate">{{ task.title }}</span>
              </span>
              <span class="shrink-0 text-[11px] font-semibold uppercase" :class="URGENCY[task.urgency].text">{{ task.urgency }}</span>
            </NuxtLink>
          </div>
          <p v-else class="text-sm text-[#9AA1AC]">Nothing open.</p>
        </section>
      </div>
    </div>
  </div>
</template>
