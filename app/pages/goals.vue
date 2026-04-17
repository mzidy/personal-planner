<script setup lang="ts">
import type { GoalAreaWithMilestones } from '~~/shared/types/planner'

definePageMeta({
  middleware: 'protected'
})

const { percent, longDate, toIso } = useExecutiveFormat()
const { data: goals, refresh } = await usePlannerFetch<GoalAreaWithMilestones[]>('goals-page', '/api/goals')

const form = reactive({
  title: 'New yearly goal',
  summary: 'Describe the target in one calm sentence.',
  currentPercent: 0,
  targetPercent: 100,
  tone: 'ink',
  dueDate: new Date().toISOString().slice(0, 16)
})

async function createGoal() {
  await $fetch('/api/goals', {
    method: 'POST',
    body: {
      ...form,
      dueDate: toIso(form.dueDate)
    }
  })
  await refresh()
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Architectural Focus"
      title="Yearly goals"
      subtitle="Track long arcs without turning them into motivational clutter. Progress stays measured, milestones stay concrete."
    />

    <div class="grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
      <div class="grid gap-6 md:grid-cols-2">
        <PanelCard v-for="goal in goals" :key="goal.id" :tone="goal.tone === 'ink' ? 'light' : 'muted'" class="space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="eyebrow">Goal area</p>
              <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ goal.title }}</h2>
            </div>
            <StatusPill :label="percent(goal.currentPercent)" :tone="goal.tone === 'teal' ? 'teal' : 'ink'" />
          </div>
          <p class="text-sm leading-7 text-muted">{{ goal.summary }}</p>
          <div class="h-2 rounded-full bg-surface-high">
            <div class="h-2 rounded-full bg-accent" :style="{ width: `${goal.currentPercent}%` }" />
          </div>
          <p class="text-sm text-muted">Target date: {{ goal.dueDate ? longDate(goal.dueDate) : 'Open ended' }}</p>
          <div class="space-y-2">
            <p class="eyebrow">Milestones</p>
            <div v-for="milestone in goal.milestones" :key="milestone.id" class="rounded-soft bg-surface-low px-4 py-3">
              <div class="flex items-center justify-between gap-4">
                <p class="font-medium text-ink">{{ milestone.title }}</p>
                <StatusPill :label="milestone.status" :tone="milestone.status === 'completed' ? 'teal' : 'mist'" />
              </div>
            </div>
          </div>
        </PanelCard>
      </div>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Create Goal</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Add a new yearly trajectory.</h2>
        </div>
        <form class="space-y-3" @submit.prevent="createGoal">
          <input v-model="form.title" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" />
          <textarea v-model="form.summary" class="min-h-[8rem] w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" />
          <input v-model.number="form.currentPercent" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="number" min="0" max="100" />
          <input v-model.number="form.targetPercent" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="number" min="0" max="100" />
          <select v-model="form.tone" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option value="ink">Ink</option>
            <option value="teal">Teal</option>
            <option value="mist">Mist</option>
          </select>
          <input v-model="form.dueDate" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="datetime-local" />
          <button class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white">Create goal</button>
        </form>
      </PanelCard>
    </div>
  </div>
</template>
