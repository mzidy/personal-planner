<script setup lang="ts">
import type { AiBriefPayload, DashboardPayload } from '~~/shared/types/planner'

definePageMeta({
  middleware: 'protected'
})

const { data: brief, refresh } = await usePlannerFetch<AiBriefPayload>('assistant-brief', '/api/ai/brief')
const { data: dashboard } = await usePlannerFetch<DashboardPayload>('assistant-dashboard', '/api/dashboard')
</script>

<template>
  <div v-if="brief && dashboard" class="space-y-8">
    <AppPageHero
      eyebrow="Executive AI"
      title="Read-only strategic brief"
      subtitle="The assistant can summarize, rank, and coach, but it never changes data without an explicit product decision beyond v1."
    />

    <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <PanelCard class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="eyebrow">Concierge Session</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ brief.headline }}</h2>
          </div>
          <button class="rounded-full bg-surface-low px-4 py-2 text-sm font-semibold text-ink" @click="refresh()">
            Refresh brief
          </button>
        </div>

        <div class="space-y-4">
          <div class="max-w-3xl rounded-[1.75rem] bg-surface-low px-5 py-5 text-sm leading-7 text-ink">
            {{ brief.summary }}
          </div>
          <div
            v-for="item in brief.recommendations"
            :key="item"
            class="max-w-2xl rounded-[1.75rem] bg-[#d7e5fb] px-5 py-4 text-sm leading-7 text-accent"
          >
            {{ item }}
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <div v-for="metric in brief.metrics" :key="metric.label" class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">{{ metric.label }}</p>
            <p class="mt-2 text-xl font-semibold">{{ metric.value }}</p>
          </div>
        </div>
      </PanelCard>

      <div class="grid gap-6">
        <PanelCard tone="dark" class="space-y-4">
          <div>
            <p class="eyebrow text-white/55">Critical Focus</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Open priorities</h2>
          </div>
          <div class="space-y-3">
            <div v-for="item in dashboard.objectives.slice(0, 3)" :key="item.id" class="rounded-soft bg-white/6 px-4 py-4">
              <p class="font-semibold text-white">{{ item.title }}</p>
              <p class="mt-2 text-sm leading-6 text-white/70">{{ item.detail }}</p>
            </div>
          </div>
        </PanelCard>

        <PanelCard class="space-y-4">
          <div>
            <p class="eyebrow">Supporting context</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Today’s agenda</h2>
          </div>
          <div class="space-y-3">
            <div v-for="item in dashboard.agenda" :key="item.id" class="rounded-soft bg-surface-low px-4 py-4">
              <p class="font-semibold text-ink">{{ item.title }}</p>
              <p class="mt-2 text-sm leading-6 text-muted">{{ item.description }}</p>
            </div>
          </div>
        </PanelCard>
      </div>
    </div>
  </div>
</template>
