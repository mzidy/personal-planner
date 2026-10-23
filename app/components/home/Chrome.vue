<script setup lang="ts">
import { dueTag, euros, savingsNote, type DueTone } from '~~/shared/utils/home'

const {
  firstName,
  today,
  blocksToday,
  homework,
  routineItems,
  routineDone,
  pendingRoutine,
  toggleRoutine,
  days,
  streak,
  study,
  studyMinutes,
  loggingStudy,
  studyError,
  logStudy,
  goal,
  goalProgress,
  editingGoal,
  goalForm,
  savingGoal,
  goalError,
  editGoal,
  saveGoal
} = await useHome()

// Bars: a 30px pill for an empty day, up to 140px for the best one.
const peak = computed(() => Math.max(30, ...days.value.map(day => day.minutes)))
const bars = computed(() =>
  days.value.map((day, index) => {
    const height = 30 + (day.minutes / peak.value) * 110
    return { ...day, x: 8 + index * 42, y: 180 - height, height, thisWeek: index >= 7, isToday: index === days.value.length - 1 }
  })
)

const TAGS: Record<DueTone, string> = {
  urgent: 'bg-[#1F1535] text-[#4FD3FF]',
  week: 'bg-[#FF3FA4] text-white',
  calm: 'bg-white text-[#5F5577]'
}

const lessonsLabel = computed(() => `${blocksToday.value} ${blocksToday.value === 1 ? 'lesson' : 'lessons'}`)
const card = 'rounded-[28px] border-[3px] border-white bg-white p-6 shadow-[inset_0_0_0_1px_#B8BCC9,0_16px_40px_rgba(31,21,53,0.10)] md:p-[26px]'
const chrome = 'rounded-[28px] border-[3px] border-white bg-gradient-to-br from-white to-[#DCDDE6] p-6 shadow-[inset_0_0_0_1px_#B8BCC9] md:p-[26px]'
const field = 'w-full min-w-0 rounded-full border-0 bg-white/10 px-4 py-2.5 text-sm font-bold text-white outline-none placeholder:text-[#B8BCC9]'
</script>

<template>
  <div class="flex flex-col gap-5 text-[#1F1535]">
    <section class="flex flex-wrap items-end justify-between gap-4">
      <h1 class="font-display text-[40px] font-extrabold uppercase leading-[0.95] tracking-[-0.04em] md:text-[56px]">
        hey {{ firstName }},<br />
        <template v-if="streak > 0"><span class="text-[#FF3FA4]">{{ streak }} {{ streak === 1 ? 'day' : 'days' }}</span> strong ✦</template>
        <template v-else>let's <span class="text-[#FF3FA4]">get going</span> ✦</template>
      </h1>
      <p class="rounded-full border-2 border-white bg-gradient-to-br from-white to-[#DCDDE6] px-[18px] py-2.5 font-extrabold shadow-[inset_0_0_0_1px_#B8BCC9]">
        {{ lessonsLabel }} · {{ routineDone }} of {{ routineItems.length }} routines done
      </p>
    </section>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] items-start gap-5">
      <section class="flex flex-col gap-4" :class="card">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-xs font-extrabold uppercase tracking-[0.12em] text-[#5F5577]">Study streak · 2 weeks</p>
            <h2 class="mt-1 font-display text-[32px] font-extrabold tracking-[-0.03em]">avg {{ study.averageMinutes }} min / day</h2>
          </div>
          <p v-if="study.changePercent !== null" class="rounded-full bg-[#4FD3FF] px-3.5 py-2 font-extrabold">
            {{ study.changePercent >= 0 ? '↑' : '↓' }} {{ Math.abs(study.changePercent) }}% vs last week
          </p>
        </div>

        <svg role="img" aria-label="Study minutes per day over two weeks" viewBox="0 0 600 200" class="block h-auto w-full">
          <defs>
            <linearGradient id="chromeBars" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#FF3FA4" />
              <stop offset="1" stop-color="#4FD3FF" />
            </linearGradient>
          </defs>
          <rect
            v-for="bar in bars"
            :key="bar.day"
            :x="bar.x"
            :y="bar.y"
            width="30"
            :height="bar.height"
            rx="15"
            :fill="bar.isToday ? '#1F1535' : bar.thisWeek ? 'url(#chromeBars)' : '#DCDDE6'"
            :opacity="bar.minutes || bar.isToday ? 1 : 0.55"
          >
            <title>{{ bar.day }}: {{ bar.minutes }} min</title>
          </rect>
          <text x="8" y="196" font-size="11" fill="#5F5577" font-weight="800">LAST WEEK</text>
          <text x="302" y="196" font-size="11" fill="#5F5577" font-weight="800">THIS WEEK</text>
          <text x="548" :y="Math.max(12, bars[13]!.y - 10)" font-size="11" fill="#1F1535" font-weight="800">TODAY</text>
        </svg>

        <form class="flex flex-wrap items-center gap-2" @submit.prevent="logStudy">
          <span class="text-sm font-extrabold text-[#5F5577]">Studied today</span>
          <input
            v-model="studyMinutes"
            type="number"
            min="1"
            max="480"
            class="w-20 rounded-full border-2 border-[#B8BCC9] bg-white px-3 py-1.5 text-center font-extrabold outline-none"
            aria-label="Minutes studied"
          />
          <span class="text-sm font-bold text-[#5F5577]">min</span>
          <button class="rounded-full bg-[#FF3FA4] px-4 py-1.5 text-sm font-extrabold text-white disabled:opacity-50" :disabled="loggingStudy">
            {{ loggingStudy ? 'Saving…' : 'Add ✦' }}
          </button>
          <p v-if="studyError" class="basis-full text-xs font-bold text-[#C2187A]">{{ studyError }}</p>
        </form>

        <div class="flex flex-col gap-2.5 rounded-[20px] bg-[#1F1535] p-5 text-white">
          <template v-if="!editingGoal && goal && goalProgress">
            <div class="flex items-baseline justify-between gap-3">
              <p class="text-xs font-extrabold uppercase tracking-[0.12em] text-[#4FD3FF]">Pocket money · {{ goal.title }}</p>
              <p class="shrink-0 font-display text-[22px] font-extrabold">
                {{ euros(goal.savedAmount) }} <span class="font-body text-[13px] text-[#B8BCC9]">/ {{ euros(goal.targetAmount) }}</span>
              </p>
            </div>
            <div class="h-3.5 overflow-hidden rounded-full bg-[#3A2F55]">
              <div class="h-full rounded-full bg-gradient-to-r from-[#FF3FA4] to-[#4FD3FF]" :style="{ width: `${goalProgress.percent}%` }" />
            </div>
            <div class="flex items-center justify-between gap-3">
              <p class="text-[13px] font-semibold text-[#B8BCC9]">{{ savingsNote(goalProgress) }}</p>
              <button type="button" class="shrink-0 text-xs font-extrabold text-[#4FD3FF]" @click="editGoal">Edit</button>
            </div>
          </template>

          <form v-else-if="editingGoal" class="grid gap-2 sm:grid-cols-2" @submit.prevent="saveGoal">
            <p class="text-xs font-extrabold uppercase tracking-[0.12em] text-[#4FD3FF] sm:col-span-2">Saving for</p>
            <input v-model="goalForm.title" :class="field" class="sm:col-span-2" placeholder="Concert tickets" maxlength="60" />
            <input v-model="goalForm.targetAmount" :class="field" inputmode="decimal" placeholder="Target €" aria-label="Target in euros" />
            <input v-model="goalForm.savedAmount" :class="field" inputmode="decimal" placeholder="Saved so far €" aria-label="Saved so far in euros" />
            <input v-model="goalForm.weeklyAllowance" :class="field" class="sm:col-span-2" inputmode="decimal" placeholder="Allowance per week € (optional)" aria-label="Allowance per week in euros" />
            <p v-if="goalError" class="text-xs font-bold text-[#FF3FA4] sm:col-span-2">{{ goalError }}</p>
            <div class="flex gap-2 sm:col-span-2">
              <button class="rounded-full bg-[#FF3FA4] px-4 py-2 text-sm font-extrabold disabled:opacity-50" :disabled="savingGoal">
                {{ savingGoal ? 'Saving…' : 'Save' }}
              </button>
              <button type="button" class="rounded-full px-4 py-2 text-sm font-bold text-[#B8BCC9]" @click="editingGoal = false">Cancel</button>
            </div>
          </form>

          <button v-else type="button" class="text-left" @click="editGoal">
            <span class="block text-xs font-extrabold uppercase tracking-[0.12em] text-[#4FD3FF]">Pocket money</span>
            <span class="mt-1 block font-display text-lg font-extrabold">Saving for something? Set a goal ✦</span>
          </button>
        </div>
      </section>

      <div class="flex flex-col gap-5">
        <section class="flex flex-col gap-3" :class="chrome">
          <div class="flex items-baseline justify-between">
            <h2 class="font-display text-[22px] font-extrabold uppercase tracking-[-0.02em]">Today's routine</h2>
            <span class="font-extrabold">{{ routineDone }} / {{ routineItems.length }}</span>
          </div>
          <div class="flex flex-col gap-2">
            <div v-for="item in routineItems" :key="item.id" class="flex items-center justify-between gap-3 rounded-full bg-white px-4 py-[11px]">
              <span class="min-w-0 truncate font-bold">{{ item.description }}</span>
              <button
                type="button"
                class="shrink-0 rounded-full px-3 py-[5px] text-xs font-extrabold transition disabled:opacity-50"
                :class="item.state === 'done' ? 'bg-[#FF3FA4] text-white' : 'border-2 border-[#B8BCC9] bg-white text-[#5F5577]'"
                :disabled="pendingRoutine === item.templateId"
                @click="toggleRoutine(item)"
              >
                {{ item.state === 'done' ? 'done' : 'to do' }}
              </button>
            </div>
            <p v-if="!routineItems.length" class="rounded-full bg-white px-4 py-3 text-sm font-bold text-[#5F5577]">
              No routine yet — <NuxtLink to="/priorities/routine" class="text-[#C2187A]">add one ✦</NuxtLink>
            </p>
          </div>
        </section>

        <section class="flex flex-col gap-3" :class="card">
          <div class="flex items-baseline justify-between">
            <h2 class="font-display text-[22px] font-extrabold uppercase tracking-[-0.02em]">Homework</h2>
            <span class="font-extrabold">{{ homework.length }} open</span>
          </div>
          <div class="flex flex-col gap-2">
            <NuxtLink
              v-for="item in homework.slice(0, 6)"
              :key="item.id"
              to="/priorities"
              class="flex items-center justify-between gap-3 rounded-full bg-[#E9E3FF] px-4 py-[11px] font-bold text-[#1F1535]"
            >
              <span class="min-w-0 truncate">{{ item.title }}</span>
              <span class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold" :class="TAGS[dueTag(item.dueDate, today).tone]">
                {{ dueTag(item.dueDate, today).label }}
              </span>
            </NuxtLink>
            <p v-if="!homework.length" class="rounded-full bg-[#E9E3FF] px-4 py-3 text-sm font-bold text-[#5F5577]">
              All clear ✦ <NuxtLink to="/priorities" class="text-[#C2187A]">add homework</NuxtLink>
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
