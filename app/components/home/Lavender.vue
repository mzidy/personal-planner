<script setup lang="ts">
import type { UrgencyLevel } from '~~/shared/types/planner'

const {
  stats,
  greeting,
  today,
  blocksToday,
  tasksByUrgency,
  routineItems,
  pendingRoutine,
  toggleRoutine,
  weighIn,
  weighInValid,
  weighInError,
  savingWeighIn,
  saveWeighIn
} = await useHome()

const day = computed(() => new Date(`${today.value}T12:00:00`))
const longDate = computed(() => day.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))
const shortDate = computed(() => {
  const weekday = day.value.toLocaleDateString('en-GB', { weekday: 'short' })
  return `${weekday}, ${day.value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
})
const change = computed(() => stats.value?.twelveWeekChangeKg ?? null)

const URGENCY: Record<UrgencyLevel, string> = {
  critical: 'bg-[#D94C6C] text-white',
  high: 'bg-[#26233A] text-white',
  medium: 'bg-[#EDEAF8] text-[#4F4A6B]',
  low: 'bg-[#EDEAF8] text-[#4F4A6B]'
}

const glass = 'rounded-[28px] border border-white/90 bg-white/60 p-7 shadow-[0_24px_60px_rgba(76,60,160,0.10)] backdrop-blur-xl'
const label = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#6B6880]'
</script>

<template>
  <div class="flex flex-col gap-7 text-[#26233A]">
    <section class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1.5">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5B4BC4]">Daily Command</p>
        <h1 class="font-display text-[36px] font-extrabold leading-[1.05] tracking-[-0.04em] md:text-[48px]">{{ greeting }}</h1>
      </div>
      <p class="rounded-full border border-white/90 bg-white/60 px-[18px] py-2.5 font-medium text-[#4F4A6B]">
        {{ longDate }} · {{ blocksToday }} scheduled {{ blocksToday === 1 ? 'block' : 'blocks' }}
      </p>
    </section>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <section class="flex flex-col gap-[18px] lg:col-span-2" :class="glass">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p :class="label">Weight · last 12 weeks</p>
            <h2 class="mt-1.5 font-display text-4xl font-extrabold tracking-[-0.04em]">
              {{ stats?.currentWeightKg != null ? stats.currentWeightKg.toFixed(1) : '—' }}
              <span class="text-lg font-semibold text-[#6B6880]">kg</span>
            </h2>
          </div>
          <p
            v-if="change !== null"
            class="rounded-full px-3.5 py-2 font-bold"
            :class="change <= 0 ? 'bg-[#E3F3EA] text-[#1F6B45]' : 'bg-[#FBE7EC] text-[#A3324F]'"
          >
            {{ change > 0 ? '+' : change < 0 ? '−' : '' }}{{ Math.abs(change).toFixed(1) }} kg · 12 wk
          </p>
        </div>
        <HomeWeightLine :series="stats?.series || []" :target="stats?.profile?.targetWeightKg" variant="lavender">
          <template #empty>No weigh-ins yet — the weigh-in card adds the first one.</template>
        </HomeWeightLine>
      </section>

      <section class="flex flex-col gap-3" :class="glass">
        <p :class="label">Today</p>
        <p class="font-display text-[28px] font-extrabold tracking-[-0.03em]">{{ shortDate }}</p>
        <div class="flex flex-col gap-2.5 border-t border-[#26233A]/10 pt-3">
          <div v-for="item in routineItems" :key="item.id" class="flex items-center justify-between gap-3">
            <span class="min-w-0 truncate">{{ item.description }}</span>
            <button
              type="button"
              class="shrink-0 rounded-full px-3 py-[5px] text-xs font-bold transition disabled:opacity-50"
              :class="item.state === 'done' ? 'bg-[#E3F3EA] text-[#1F6B45]' : 'border border-[#26233A]/10 bg-white text-[#4F4A6B]'"
              :disabled="pendingRoutine === item.templateId"
              :title="item.state === 'done' ? 'Mark as planned' : 'Mark as done'"
              @click="toggleRoutine(item)"
            >
              {{ item.state === 'done' ? 'Done' : 'Planned' }}
            </button>
          </div>
          <p v-if="!routineItems.length" class="text-sm text-[#6B6880]">
            No routine yet — add one under <NuxtLink to="/priorities/routine" class="font-semibold text-[#5B4BC4]">Daily routine</NuxtLink>.
          </p>
        </div>
      </section>

      <section class="flex flex-col gap-3 lg:col-span-2" :class="glass">
        <div class="flex items-baseline justify-between gap-3">
          <p :class="label">Tasks</p>
          <p class="font-display text-[28px] font-extrabold">
            {{ tasksByUrgency.length }} <span class="font-body text-sm font-semibold text-[#6B6880]">open</span>
          </p>
        </div>
        <div v-if="tasksByUrgency.length" class="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-2.5">
          <NuxtLink
            v-for="task in tasksByUrgency.slice(0, 9)"
            :key="task.id"
            to="/priorities"
            class="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 font-medium text-[#26233A]"
          >
            <span class="min-w-0 truncate">{{ task.title }}</span>
            <span class="shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-bold uppercase" :class="URGENCY[task.urgency]">{{ task.urgency }}</span>
          </NuxtLink>
        </div>
        <p v-else class="text-sm text-[#6B6880]">Nothing open — add one under <NuxtLink to="/priorities" class="font-semibold text-[#5B4BC4]">Tasks</NuxtLink>.</p>
      </section>

      <section class="flex flex-col gap-3 rounded-[28px] bg-gradient-to-br from-[#8B7BD8] to-[#6C7BE0] p-7 text-white shadow-[0_24px_60px_rgba(76,60,160,0.25)]">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Weigh-in</p>
        <p class="font-display text-2xl font-extrabold tracking-[-0.03em]">
          {{ stats?.currentWeekLogged ? 'This week is in' : 'This week is missing' }}
        </p>
        <form class="flex flex-col gap-2.5 pt-2" @submit.prevent="saveWeighIn">
          <label class="flex flex-col gap-1.5">
            <span class="text-[11px] uppercase tracking-[0.18em] text-white/85">Date</span>
            <input v-model="weighIn.date" type="date" class="rounded-[14px] border-0 bg-white/90 px-3.5 py-3 text-[#26233A] outline-none" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[11px] uppercase tracking-[0.18em] text-white/85">Weight (kg)</span>
            <input
              v-model="weighIn.weight"
              type="text"
              inputmode="decimal"
              :placeholder="stats?.currentWeightKg != null ? stats.currentWeightKg.toFixed(1) : '84.0'"
              class="rounded-[14px] border-0 bg-white/90 px-3.5 py-3 text-[#26233A] outline-none"
            />
          </label>
          <p v-if="weighInError" class="rounded-xl bg-white/90 px-3 py-2 text-xs text-[#A3324F]">{{ weighInError }}</p>
          <button class="rounded-full bg-[#26233A] px-5 py-[13px] font-bold text-white disabled:opacity-50" :disabled="!weighInValid || savingWeighIn">
            {{ savingWeighIn ? 'Saving…' : 'Save weigh-in' }}
          </button>
        </form>
      </section>
    </div>
  </div>
</template>
