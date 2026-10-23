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

// Dots: low on the axis for an empty day, near the top for the best one. The
// best day of each week and today get a stem down to the axis.
const peak = computed(() => Math.max(30, ...days.value.map(day => day.minutes)))
const dots = computed(() => {
  const best = (from: number, to: number) => {
    const slice = days.value.slice(from, to)
    const top = Math.max(...slice.map(day => day.minutes))
    return top > 0 ? from + slice.findIndex(day => day.minutes === top) : -1
  }
  const stems = new Set([best(0, 7), best(7, 13)])
  return days.value.map((day, index) => ({
    ...day,
    x: 23 + index * 42,
    y: 150 - (day.minutes / peak.value) * 105,
    thisWeek: index >= 7,
    isToday: index === days.value.length - 1,
    stem: stems.has(index)
  }))
})

const TAGS: Record<DueTone, string> = {
  urgent: 'bg-[#F26B1D] text-white',
  week: 'bg-[#0F8B8D] text-white',
  calm: 'border-2 border-[#18242A]'
}

const lessonsLabel = computed(() => `${blocksToday.value} ${blocksToday.value === 1 ? 'lesson' : 'lessons'}`)
const ink = 'border-2 border-[#18242A]'
const field = 'w-full min-w-0 rounded-xl border-2 border-[#18242A] bg-white px-3 py-2 text-sm font-medium outline-none'
</script>

<template>
  <div class="flex flex-col gap-7 text-[#18242A]">
    <section class="flex flex-wrap items-end justify-between gap-4">
      <h1 class="text-[44px] font-black uppercase italic leading-[0.95] tracking-[-0.05em] md:text-[60px]">
        What's up,<br /><span class="text-[#0F8B8D]">{{ firstName }}</span>
      </h1>
      <div class="flex gap-2.5">
        <p class="rounded-full bg-white px-4 py-2.5 font-bold" :class="ink">{{ lessonsLabel }}</p>
        <p class="rotate-2 rounded-full bg-[#F26B1D] px-4 py-2.5 font-black text-white" :class="ink">
          {{ streak }}-day streak
        </p>
      </div>
    </section>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] items-start gap-5">
      <section class="flex flex-col gap-4 rounded-[20px] bg-white p-6 shadow-[6px_6px_0_#0F8B8D] md:p-[26px]" :class="ink">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-[13px] font-bold uppercase tracking-[0.1em] text-[#5A6A70]">Study streak · 2 weeks</p>
            <h2 class="mt-0.5 text-[32px] font-black tracking-[-0.04em]">{{ streak }} {{ streak === 1 ? 'day' : 'days' }} rolling</h2>
          </div>
          <p class="rounded-full bg-[#0F8B8D] px-3 py-1.5 font-bold text-white">avg {{ study.averageMinutes }} min / day</p>
        </div>

        <svg role="img" aria-label="Study minutes per day over two weeks" viewBox="0 0 600 200" class="block h-auto w-full">
          <line x1="0" y1="180" x2="600" y2="180" stroke="#18242A" stroke-width="2" />
          <template v-for="dot in dots" :key="dot.day">
            <line
              v-if="dot.stem || dot.isToday"
              :x1="dot.x"
              :x2="dot.x"
              :y1="dot.y + (dot.isToday ? 18 : 14)"
              y2="180"
              stroke="#18242A"
              stroke-width="2"
              :stroke-dasharray="dot.isToday ? undefined : '4 4'"
            />
            <circle
              :cx="dot.x"
              :cy="dot.y"
              :r="dot.isToday ? 18 : 14"
              :fill="dot.isToday ? '#F26B1D' : dot.thisWeek ? '#0F8B8D' : '#BFE8E8'"
              :stroke="dot.isToday ? '#18242A' : undefined"
              :stroke-width="dot.isToday ? 2 : undefined"
            >
              <title>{{ dot.day }}: {{ dot.minutes }} min</title>
            </circle>
          </template>
          <text x="8" y="197" font-size="11" fill="#5A6A70" font-weight="700">LAST WEEK</text>
          <text x="302" y="197" font-size="11" fill="#5A6A70" font-weight="700">THIS WEEK</text>
          <text x="551" :y="Math.max(12, dots[13]!.y - 24)" font-size="11" fill="#18242A" font-weight="900">TODAY</text>
        </svg>

        <form class="flex flex-wrap items-center gap-2" @submit.prevent="logStudy">
          <span class="text-sm font-bold text-[#5A6A70]">Studied today</span>
          <input v-model="studyMinutes" type="number" min="1" max="480" class="w-20 rounded-xl bg-white px-3 py-1.5 text-center font-bold outline-none" :class="ink" aria-label="Minutes studied" />
          <span class="text-sm font-bold text-[#5A6A70]">min</span>
          <button class="rounded-xl bg-[#18242A] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50" :disabled="loggingStudy">
            {{ loggingStudy ? 'Saving…' : 'Log it' }}
          </button>
          <p v-if="studyError" class="basis-full text-xs font-bold text-[#F26B1D]">{{ studyError }}</p>
        </form>

        <div class="flex flex-col gap-2.5 rounded-2xl bg-[#FDE7D9] p-[18px]" :class="ink">
          <template v-if="!editingGoal && goal && goalProgress">
            <div class="flex items-baseline justify-between gap-3">
              <p class="font-black uppercase tracking-[-0.02em]">{{ goal.title }}</p>
              <p class="shrink-0 text-[22px] font-black">
                {{ euros(goal.savedAmount) }} <span class="text-[13px] font-medium text-[#5A6A70]">of {{ euros(goal.targetAmount) }}</span>
              </p>
            </div>
            <div class="h-4 overflow-hidden rounded-full bg-white" :class="ink">
              <div class="h-full bg-[#F26B1D]" :style="{ width: `${goalProgress.percent}%` }" />
            </div>
            <div class="flex items-center justify-between gap-3">
              <p class="text-[13px] font-medium text-[#5A6A70]">{{ savingsNote(goalProgress) }}</p>
              <button type="button" class="shrink-0 text-xs font-black text-[#0F8B8D]" @click="editGoal">Edit</button>
            </div>
          </template>

          <form v-else-if="editingGoal" class="grid gap-2 sm:grid-cols-2" @submit.prevent="saveGoal">
            <p class="font-black uppercase sm:col-span-2">Saving for</p>
            <input v-model="goalForm.title" :class="field" class="sm:col-span-2" placeholder="Skateboard fund" maxlength="60" />
            <input v-model="goalForm.targetAmount" :class="field" inputmode="decimal" placeholder="Target €" aria-label="Target in euros" />
            <input v-model="goalForm.savedAmount" :class="field" inputmode="decimal" placeholder="Saved so far €" aria-label="Saved so far in euros" />
            <input v-model="goalForm.weeklyAllowance" :class="field" class="sm:col-span-2" inputmode="decimal" placeholder="Allowance per week € (optional)" aria-label="Allowance per week in euros" />
            <p v-if="goalError" class="text-xs font-bold text-[#C2410C] sm:col-span-2">{{ goalError }}</p>
            <div class="flex gap-2 sm:col-span-2">
              <button class="rounded-xl bg-[#F26B1D] px-4 py-2 text-sm font-black text-white disabled:opacity-50" :class="ink" :disabled="savingGoal">
                {{ savingGoal ? 'Saving…' : 'Save' }}
              </button>
              <button type="button" class="rounded-xl px-4 py-2 text-sm font-bold text-[#5A6A70]" @click="editingGoal = false">Cancel</button>
            </div>
          </form>

          <button v-else type="button" class="text-left" @click="editGoal">
            <span class="block font-black uppercase">Saving up?</span>
            <span class="mt-1 block text-sm font-medium text-[#5A6A70]">Set a goal and see how many weeks of allowance it takes.</span>
          </button>
        </div>
      </section>

      <div class="flex flex-col gap-5">
        <section class="flex flex-col gap-2.5 rounded-[20px] bg-[#BFE8E8] p-6 shadow-[6px_6px_0_#18242A] md:p-[26px]" :class="ink">
          <div class="flex items-baseline justify-between">
            <h2 class="text-xl font-black uppercase tracking-[-0.03em]">Today's routine</h2>
            <span class="font-black">{{ routineDone }} / {{ routineItems.length }}</span>
          </div>
          <div class="flex flex-col gap-1.5">
            <label v-for="item in routineItems" :key="item.id" class="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2.5" :class="ink">
              <input
                type="checkbox"
                class="h-5 w-5 accent-[#0F8B8D]"
                :checked="item.state === 'done'"
                :disabled="pendingRoutine === item.templateId"
                @change="toggleRoutine(item)"
              />
              <span class="flex-1" :class="item.state === 'done' ? 'font-medium text-[#5A6A70] line-through' : 'font-bold'">{{ item.description }}</span>
            </label>
            <p v-if="!routineItems.length" class="rounded-xl bg-white px-3 py-2.5 text-sm font-medium" :class="ink">
              No routine yet — <NuxtLink to="/priorities/routine" class="font-bold text-[#0F8B8D]">set one up</NuxtLink>
            </p>
          </div>
        </section>

        <section class="flex flex-col gap-2.5 rounded-[20px] bg-white p-6 shadow-[6px_6px_0_#F26B1D] md:p-[26px]" :class="ink">
          <div class="flex items-baseline justify-between">
            <h2 class="text-xl font-black uppercase tracking-[-0.03em]">Homework</h2>
            <span class="font-black">{{ homework.length }} open</span>
          </div>
          <div class="flex flex-col gap-1.5">
            <NuxtLink
              v-for="item in homework.slice(0, 6)"
              :key="item.id"
              to="/priorities"
              class="flex items-center justify-between gap-3 rounded-xl bg-[#F7F4EE] px-3 py-2.5 font-medium text-[#18242A]"
            >
              <span class="min-w-0 truncate">{{ item.title }}</span>
              <span class="shrink-0 rounded-full px-2.5 py-[3px] text-xs font-black" :class="TAGS[dueTag(item.dueDate, today).tone]">
                {{ dueTag(item.dueDate, today).label }}
              </span>
            </NuxtLink>
            <p v-if="!homework.length" class="rounded-xl bg-[#F7F4EE] px-3 py-2.5 text-sm font-medium">
              Nothing due — <NuxtLink to="/priorities" class="font-bold text-[#0F8B8D]">add homework</NuxtLink>
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
