<script setup lang="ts">
import type { PortfolioOverview, PortfolioRuleRecord } from '~~/shared/types/portfolio'

definePageMeta({
  middleware: 'protected'
})

const { data: overview, refresh } = await usePlannerFetch<PortfolioOverview>(
  'portfolio-overview',
  '/api/portfolio/overview'
)

const TABS = [
  { label: 'Overview', to: '/finance' },
  { label: 'Investing', to: '/finance/investing' },
  { label: 'Income', to: '/finance/income' },
  { label: 'Expenses', to: '/finance/expenses' },
  { label: 'Portfolio management', to: '/finance/portfolio' }
]

const route = useRoute()

const form = reactive({
  name: '',
  description: '',
  dateSet: '',
  isIndex: false,
  geo: ''
})

const saving = ref(false)
const errorMessage = ref('')

onMounted(() => {
  if (!form.dateSet) {
    form.dateSet = new Date().toISOString().slice(0, 10)
  }
})

function money(value: number | undefined) {
  return (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

async function addRule() {
  const name = form.name.trim()
  if (!name || saving.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/portfolio/rules', {
      method: 'POST',
      body: {
        name,
        description: form.description.trim(),
        dateSet: form.dateSet || undefined,
        isIndex: form.isIndex,
        geo: form.geo.trim()
      }
    })
    form.name = ''
    form.description = ''
    form.isIndex = false
    form.geo = ''
    await refresh()
  } catch {
    errorMessage.value = 'Unable to save that rule. Check the name and date.'
  } finally {
    saving.value = false
  }
}

async function deleteRule(rule: PortfolioRuleRecord) {
  errorMessage.value = ''

  try {
    await $fetch(`/api/portfolio/rules/${rule.id}`, { method: 'DELETE' })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to delete that rule.'
  }
}
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <AppPageHero
      eyebrow="Discipline"
      title="Portfolio management"
      subtitle="Write down the rules you intend to invest by, then hold the portfolio against them."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Rules set</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ overview.rules.length }}</p>
          <p class="mt-2 text-sm text-muted">{{ overview.positions.length }} positions to check</p>
        </PanelCard>
      </template>
    </AppPageHero>

    <div class="flex flex-wrap items-center gap-2">
      <NuxtLink
        v-for="tab in TABS"
        :key="tab.to"
        :to="tab.to"
        class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
        :class="route.path === tab.to ? 'bg-ink text-white' : 'bg-surface-low text-ink hover:bg-surface'"
      >
        {{ tab.label }}
      </NuxtLink>
    </div>

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <!-- Section 1: rules -->
    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">Section 1</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Set rules</h2>
        <p class="mt-1 text-sm text-muted">The constraints you have decided to invest by.</p>
      </div>

      <p v-if="!overview.rules.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm text-muted">
        No rules yet — add your first one below.
      </p>

      <div v-else class="space-y-3">
        <article v-for="rule in overview.rules" :key="rule.id" class="rounded-soft bg-surface-low px-5 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-ink">{{ rule.name }}</p>
                <StatusPill v-if="rule.isIndex" label="Index" tone="teal" />
                <StatusPill v-if="rule.geo" :label="rule.geo" tone="mist" />
              </div>
              <p v-if="rule.description" class="mt-2 text-sm leading-6 text-muted">{{ rule.description }}</p>
              <p class="mt-2 text-xs text-muted">Set {{ formatDate(rule.dateSet) }}</p>
            </div>
            <button class="shrink-0 text-xs font-semibold text-rose-700" @click="deleteRule(rule)">Delete</button>
          </div>
        </article>
      </div>

      <form class="space-y-3 border-t border-outline/10 pt-4" @submit.prevent="addRule">
        <input
          v-model="form.name"
          class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
          type="text"
          placeholder="Rule name, e.g. Never more than 5% in a single stock"
          required
        />
        <input
          v-model="form.description"
          class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
          type="text"
          placeholder="Additional description (optional)"
        />
        <div class="grid gap-3 md:grid-cols-3">
          <label class="block">
            <span class="eyebrow">Date set</span>
            <input
              v-model="form.dateSet"
              class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="date"
            />
          </label>
          <label class="block">
            <span class="eyebrow">Geo</span>
            <input
              v-model="form.geo"
              class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="text"
              placeholder="e.g. Global, US, Europe"
            />
          </label>
          <label class="flex items-center gap-3 self-end rounded-2xl bg-surface-low px-4 py-3">
            <input v-model="form.isIndex" class="h-4 w-4 accent-black" type="checkbox" />
            <span class="text-sm font-semibold text-ink">Is index</span>
          </label>
        </div>
        <button
          class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
          :disabled="saving || !form.name.trim()"
        >
          Add rule
        </button>
      </form>
    </PanelCard>

    <!-- Section 2: portfolio -->
    <PanelCard class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="eyebrow">Section 2</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Portfolio</h2>
          <p class="mt-1 text-sm text-muted">The holdings these rules will be challenged against.</p>
        </div>
        <div v-if="overview.positions.length" class="text-right">
          <p class="eyebrow">Market value</p>
          <p class="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">{{ money(overview.marketValue) }}</p>
        </div>
      </div>

      <p v-if="!overview.positions.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm leading-6 text-muted">
        No positions yet. Add them under
        <NuxtLink to="/investments" class="font-semibold text-accent">Investments</NuxtLink>
        and they will appear here to be checked against your rules.
      </p>

      <div v-else class="space-y-3">
        <div
          v-for="position in overview.positions"
          :key="position.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-soft bg-surface-low px-5 py-4"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-semibold text-ink">{{ position.symbol }}</p>
              <StatusPill :label="position.kind" tone="mist" />
            </div>
            <p v-if="position.name" class="mt-1 text-sm text-muted">{{ position.name }}</p>
          </div>
          <p class="shrink-0 font-semibold text-ink">{{ money(position.marketValue) }}</p>
        </div>
      </div>

      <p class="rounded-soft bg-surface-low px-4 py-3 text-xs leading-5 text-muted">
        Checking positions against the rules above is not built yet — the rules and the holdings are
        recorded separately for now.
      </p>
    </PanelCard>
  </div>
</template>
