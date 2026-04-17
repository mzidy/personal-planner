<script setup lang="ts">
import type { ObjectiveRecord } from '~~/shared/types/planner'

definePageMeta({
  middleware: 'protected'
})

const { data: objectives, refresh } = await usePlannerFetch<ObjectiveRecord[]>('priorities-page', '/api/priorities')

const form = reactive({
  title: '',
  detail: '',
  status: 'focus',
  urgency: 'medium',
  focusWindow: 'Morning deep work'
})

const groups = computed(() => {
  const source = objectives.value || []
  return [
    { key: 'focus', title: 'Immediate Action', items: source.filter(item => item.status === 'focus') },
    { key: 'scheduled', title: 'Strategic Growth', items: source.filter(item => item.status === 'scheduled') },
    { key: 'delegated', title: 'Delegation Hub', items: source.filter(item => item.status === 'delegated') },
    { key: 'backlog', title: 'Backlog & Noise', items: source.filter(item => item.status === 'backlog') }
  ]
})

async function createObjective() {
  await $fetch('/api/priorities', {
    method: 'POST',
    body: form
  })
  form.title = ''
  form.detail = ''
  await refresh()
}

async function markDone(id: string) {
  await $fetch(`/api/priorities/${id}`, {
    method: 'PATCH',
    body: {
      status: 'done'
    }
  })
  await refresh()
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Operational Focus"
      title="Executive priorities"
      subtitle="Keep the decision-heavy work visible, move the rest to deliberate slots, and mark finished work without clutter."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Live count</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ objectives?.length || 0 }}</p>
          <p class="mt-2 text-sm text-muted">tracked objectives</p>
        </PanelCard>
      </template>
    </AppPageHero>

    <div class="grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
      <div class="grid gap-6 md:grid-cols-2">
        <PanelCard v-for="group in groups" :key="group.key" class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="eyebrow">{{ group.title }}</p>
              <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ group.items.length }} items</h2>
            </div>
            <StatusPill :label="group.key" :tone="group.key === 'focus' ? 'ink' : group.key === 'scheduled' ? 'teal' : 'mist'" />
          </div>
          <div class="space-y-3">
            <article v-for="item in group.items" :key="item.id" class="rounded-soft bg-surface-low px-5 py-4">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-ink">{{ item.title }}</p>
                <StatusPill :label="item.urgency" :tone="item.urgency === 'critical' ? 'danger' : item.urgency === 'high' ? 'ink' : 'mist'" />
              </div>
              <p class="mt-2 text-sm leading-6 text-muted">{{ item.detail }}</p>
              <div class="mt-4 flex items-center justify-between text-sm text-muted">
                <span>{{ item.focusWindow }}</span>
                <button class="font-semibold text-ink" @click="markDone(item.id)">Mark done</button>
              </div>
            </article>
          </div>
        </PanelCard>
      </div>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">New Objective</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Capture the next deliberate move.</h2>
        </div>
        <form class="space-y-3" @submit.prevent="createObjective">
          <input v-model="form.title" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" placeholder="Objective title" required />
          <textarea
            v-model="form.detail"
            class="min-h-[8rem] w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            placeholder="Describe the scope and the reason it matters."
            required
          />
          <select v-model="form.status" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option value="focus">Immediate action</option>
            <option value="scheduled">Scheduled</option>
            <option value="delegated">Delegated</option>
            <option value="backlog">Backlog</option>
          </select>
          <select v-model="form.urgency" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input v-model="form.focusWindow" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" placeholder="Best focus window" />
          <button class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white">Add objective</button>
        </form>
      </PanelCard>
    </div>
  </div>
</template>
