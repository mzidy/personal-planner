<script setup lang="ts">
import type { TimeBlockRecord } from '~~/shared/types/planner'

definePageMeta({
  middleware: 'protected'
})

const { shortDate, shortTime, toIso } = useExecutiveFormat()
const { data: blocks, refresh } = await usePlannerFetch<TimeBlockRecord[]>('calendar-page', '/api/calendar')

const groupedBlocks = computed(() => {
  const groups = new Map<string, TimeBlockRecord[]>()
  for (const block of blocks.value || []) {
    const key = block.startsAt.slice(0, 10)
    groups.set(key, [...(groups.get(key) || []), block])
  }
  return [...groups.entries()].map(([day, items]) => ({
    day,
    items: items.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }))
})

const form = reactive({
  title: 'Quiet deep work',
  description: 'Protect one uninterrupted block for the highest leverage deliverable.',
  startsAt: new Date().toISOString().slice(0, 16),
  endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  kind: 'focus',
  tone: 'teal'
})

async function createBlock() {
  await $fetch('/api/calendar', {
    method: 'POST',
    body: {
      ...form,
      startsAt: toIso(form.startsAt),
      endsAt: toIso(form.endsAt)
    }
  })
  await refresh()
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Executive Flow"
      title="Calendar and time blocks"
      subtitle="Shape the calendar around real energy and deliberate work, not passive meeting accumulation."
    />

    <div class="grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
      <PanelCard class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="eyebrow">Schedule</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Upcoming agenda</h2>
          </div>
          <StatusPill :label="`${blocks?.length || 0} blocks`" tone="mist" />
        </div>

        <div class="space-y-6">
          <section v-for="group in groupedBlocks" :key="group.day" class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="font-display text-xl font-bold tracking-[-0.04em]">
                {{ shortDate(group.items[0]?.startsAt || `${group.day}T09:00:00.000Z`) }}
              </p>
              <span class="text-sm text-muted">{{ group.items.length }} scheduled</span>
            </div>
            <article v-for="item in group.items" :key="item.id" class="rounded-soft bg-surface-low px-5 py-4">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-ink">{{ item.title }}</p>
                <StatusPill :label="item.kind" :tone="item.kind === 'meeting' ? 'ink' : 'teal'" />
              </div>
              <p class="mt-2 text-sm leading-6 text-muted">{{ item.description }}</p>
              <p class="mt-3 text-sm font-medium text-ink">{{ shortTime(item.startsAt) }} - {{ shortTime(item.endsAt) }}</p>
            </article>
          </section>
        </div>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Add Time Block</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Reserve the next clean hour.</h2>
        </div>
        <form class="space-y-3" @submit.prevent="createBlock">
          <input v-model="form.title" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" required />
          <textarea v-model="form.description" class="min-h-[7rem] w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" />
          <input v-model="form.startsAt" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="datetime-local" />
          <input v-model="form.endsAt" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="datetime-local" />
          <select v-model="form.kind" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option value="focus">Focus</option>
            <option value="meeting">Meeting</option>
            <option value="travel">Travel</option>
            <option value="admin">Admin</option>
          </select>
          <select v-model="form.tone" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option value="teal">Teal highlight</option>
            <option value="ink">Ink panel</option>
            <option value="mist">Mist block</option>
          </select>
          <button class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white">Create block</button>
        </form>
      </PanelCard>
    </div>
  </div>
</template>
