<script setup lang="ts">
import type { DashboardPayload } from '~~/shared/types/planner'

definePageMeta({
  middleware: 'protected'
})

const { currency, shortTime, percent, toIso } = useExecutiveFormat()
const { data: dashboard, refresh } = await usePlannerFetch<DashboardPayload>('dashboard-page', '/api/dashboard')

const journalForm = reactive({
  title: 'Quick diary',
  body: '',
  prompt: 'What deserves protection before the day fragments?',
  focusTag: 'Reflection'
})

const focusForm = reactive({
  title: 'Deep work block',
  plannedMinutes: 60,
  actualMinutes: 60,
  startedAt: new Date().toISOString().slice(0, 16),
  endedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
})

const busy = reactive({
  journal: false,
  focus: false
})

async function submitJournal() {
  busy.journal = true
  try {
    await $fetch('/api/journal', {
      method: 'POST',
      body: journalForm
    })
    journalForm.body = ''
    await refresh()
  } finally {
    busy.journal = false
  }
}

async function submitFocusSession() {
  busy.focus = true
  try {
    await $fetch('/api/focus-sessions', {
      method: 'POST',
      body: {
        ...focusForm,
        startedAt: toIso(focusForm.startedAt),
        endedAt: toIso(focusForm.endedAt)
      }
    })
    await refresh()
  } finally {
    busy.focus = false
  }
}
</script>

<template>
  <div v-if="dashboard" class="space-y-8">
    <AppPageHero
      eyebrow="Daily Command"
      :title="`${dashboard.greeting} Your agenda is ${dashboard.completionRate}% aligned.`"
      :subtitle="`${dashboard.dateLabel}. Focus and finance remain visible without turning the workspace into a dashboard spreadsheet.`"
    >
      <template #aside>
        <PanelCard class="min-w-[15rem]" tone="muted">
          <p class="eyebrow">Today</p>
          <p class="mt-3 font-display text-3xl font-bold tracking-[-0.05em]">{{ dashboard.dateLabel }}</p>
          <p class="mt-2 text-sm text-muted">{{ dashboard.agenda.length }} scheduled blocks</p>
        </PanelCard>
      </template>
    </AppPageHero>

    <div class="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
      <PanelCard class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="eyebrow">Day At A Glance</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Protected schedule</h2>
          </div>
          <StatusPill :label="`${dashboard.agenda.length} blocks`" tone="mist" />
        </div>

        <div class="space-y-4">
          <article
            v-for="item in dashboard.agenda"
            :key="item.id"
            class="grid gap-2 rounded-soft bg-surface-low px-5 py-4 md:grid-cols-[5rem_1fr]"
          >
            <div class="text-sm font-semibold text-muted">{{ shortTime(item.startsAt) }}</div>
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-ink">{{ item.title }}</p>
                <StatusPill :label="item.kind" :tone="item.kind === 'meeting' ? 'ink' : 'teal'" />
              </div>
              <p class="text-sm leading-6 text-muted">{{ item.description }}</p>
            </div>
          </article>
        </div>
      </PanelCard>

      <PanelCard tone="dark" class="space-y-6">
        <div>
          <p class="eyebrow text-white/55">AI Insights</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Concierge live</h2>
        </div>
        <div class="rounded-soft bg-white/6 p-5 text-sm leading-7 text-white/80">
          {{ dashboard.aiBrief.summary }}
        </div>
        <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
          <div v-for="metric in dashboard.aiBrief.metrics" :key="metric.label" class="rounded-soft bg-white/6 px-4 py-4">
            <p class="eyebrow text-white/45">{{ metric.label }}</p>
            <p class="mt-2 text-xl font-semibold text-white">{{ metric.value }}</p>
          </div>
        </div>
        <ul class="space-y-3 text-sm text-white/78">
          <li v-for="item in dashboard.aiBrief.recommendations" :key="item" class="rounded-soft bg-white/6 px-4 py-3">
            {{ item }}
          </li>
        </ul>
      </PanelCard>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.1fr_1fr_0.8fr]">
      <PanelCard class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="eyebrow">Personal Finance</p>
            <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ currency(dashboard.finance.netWorth) }}</h3>
          </div>
          <StatusPill :label="`${dashboard.finance.budgetHealth} health`" tone="teal" />
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Spend</p>
            <p class="mt-2 text-xl font-semibold">{{ currency(dashboard.finance.monthlySpend) }}</p>
          </div>
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Income</p>
            <p class="mt-2 text-xl font-semibold">{{ currency(dashboard.finance.monthlyIncome) }}</p>
          </div>
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Savings rate</p>
            <p class="mt-2 text-xl font-semibold">{{ percent(dashboard.finance.savingsRate) }}</p>
          </div>
        </div>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="eyebrow">Top Priorities</p>
            <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Operational focus</h3>
          </div>
          <NuxtLink class="text-sm font-semibold text-muted hover:text-ink" to="/priorities">View all</NuxtLink>
        </div>
        <div class="space-y-3">
          <article v-for="item in dashboard.objectives.slice(0, 3)" :key="item.id" class="rounded-soft bg-surface-low px-5 py-4">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-semibold text-ink">{{ item.title }}</p>
              <StatusPill :label="item.urgency" :tone="item.urgency === 'critical' ? 'danger' : item.urgency === 'high' ? 'ink' : 'mist'" />
            </div>
            <p class="mt-2 text-sm leading-6 text-muted">{{ item.detail }}</p>
          </article>
        </div>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Yearly Goals</p>
          <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Visible progress</h3>
        </div>
        <div class="space-y-3">
          <div v-for="goal in dashboard.goals" :key="goal.id" class="rounded-soft bg-surface-low px-4 py-4">
            <div class="flex items-center justify-between text-sm">
              <span class="font-semibold text-ink">{{ goal.title }}</span>
              <span class="text-muted">{{ percent(goal.currentPercent) }}</span>
            </div>
            <div class="mt-3 h-2 rounded-full bg-white">
              <div class="h-2 rounded-full bg-accent" :style="{ width: `${goal.currentPercent}%` }" />
            </div>
          </div>
        </div>
      </PanelCard>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Quick Diary</p>
          <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Capture signal before it evaporates.</h3>
        </div>
        <form class="space-y-3" @submit.prevent="submitJournal">
          <input v-model="journalForm.title" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" />
          <textarea
            v-model="journalForm.body"
            class="min-h-[9rem] w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            :placeholder="dashboard.quickJournalPrompt"
          />
          <button class="rounded-full bg-ink px-5 py-3 font-semibold text-white" :disabled="busy.journal">
            {{ busy.journal ? 'Storing...' : 'Store reflection' }}
          </button>
        </form>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Focus Tracking</p>
          <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Deep work pulse</h3>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Actual</p>
            <p class="mt-2 text-xl font-semibold">{{ dashboard.focus.actualMinutes }} min</p>
          </div>
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Planned</p>
            <p class="mt-2 text-xl font-semibold">{{ dashboard.focus.plannedMinutes }} min</p>
          </div>
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Best window</p>
            <p class="mt-2 text-xl font-semibold">{{ dashboard.focus.bestWindow }}</p>
          </div>
        </div>

        <form class="grid gap-3 md:grid-cols-2" @submit.prevent="submitFocusSession">
          <input v-model="focusForm.title" class="rounded-2xl bg-surface-low px-4 py-3 outline-none md:col-span-2" type="text" />
          <input v-model.number="focusForm.plannedMinutes" class="rounded-2xl bg-surface-low px-4 py-3 outline-none" type="number" min="15" />
          <input v-model.number="focusForm.actualMinutes" class="rounded-2xl bg-surface-low px-4 py-3 outline-none" type="number" min="0" />
          <input v-model="focusForm.startedAt" class="rounded-2xl bg-surface-low px-4 py-3 outline-none" type="datetime-local" />
          <input v-model="focusForm.endedAt" class="rounded-2xl bg-surface-low px-4 py-3 outline-none" type="datetime-local" />
          <button class="rounded-full bg-surface-low px-5 py-3 text-left font-semibold text-ink md:col-span-2">
            {{ busy.focus ? 'Logging session...' : 'Log focus session' }}
          </button>
        </form>
      </PanelCard>
    </div>
  </div>
</template>
