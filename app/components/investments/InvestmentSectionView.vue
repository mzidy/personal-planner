<script setup lang="ts">
import type {
  InvestmentKind,
  InvestmentsOverview,
  PositionWithMetrics
} from '~~/shared/types/investments'

const props = defineProps<{
  /** Omit for the portfolio overview across every kind. */
  kind?: InvestmentKind
}>()

const { data: overview, refresh } = await usePlannerFetch<InvestmentsOverview>(
  'investments-overview',
  '/api/investments/overview'
)

const TABS = [
  { label: 'Overview', to: '/investments' },
  { label: 'ETF', to: '/investments/etf' },
  { label: 'Stocks', to: '/investments/stocks' },
  { label: 'Options', to: '/investments/options' },
  { label: 'Analysis', to: '/investments/analysis' },
  { label: 'Calculator', to: '/investments/calculator' }
]

const route = useRoute()

const activeGroup = computed(() =>
  props.kind ? overview.value?.groups.find(group => group.kind === props.kind) || null : null
)

const shownTotals = computed(() => (activeGroup.value ? activeGroup.value : overview.value?.totals))

const isOption = computed(() => props.kind === 'option')

const form = reactive({
  symbol: '',
  name: '',
  quantity: '',
  unitCost: '',
  currentPrice: '',
  optionType: 'call' as 'call' | 'put',
  strike: '',
  expiry: '',
  notes: ''
})

const saving = ref(false)
const errorMessage = ref('')
const priceDrafts = reactive<Record<string, string>>({})

function money(value: number | null | undefined, currency = 'USD') {
  if (value === null || value === undefined) {
    return '—'
  }
  return value.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 })
}

function signed(value: number, currency = 'USD') {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${money(value, currency)}`
}

function tone(value: number) {
  if (value === 0) return 'text-muted'
  return value > 0 ? 'text-emerald-700' : 'text-rose-700'
}

async function addPosition() {
  if (!props.kind || saving.value) {
    return
  }

  const symbol = form.symbol.trim()
  const quantity = Number(form.quantity)
  const unitCost = Number(form.unitCost)

  if (!symbol || !quantity || Number.isNaN(unitCost)) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/investments/positions', {
      method: 'POST',
      body: {
        kind: props.kind,
        symbol,
        name: form.name.trim(),
        quantity,
        unitCost,
        currentPrice: form.currentPrice.trim() ? Number(form.currentPrice) : null,
        notes: form.notes.trim(),
        ...(isOption.value
          ? {
              optionType: form.optionType,
              strike: form.strike.trim() ? Number(form.strike) : null,
              expiry: form.expiry || null
            }
          : {})
      }
    })

    form.symbol = ''
    form.name = ''
    form.quantity = ''
    form.unitCost = ''
    form.currentPrice = ''
    form.strike = ''
    form.expiry = ''
    form.notes = ''
    await refresh()
  } catch {
    errorMessage.value = 'Unable to add that position. Check the symbol, quantity and prices.'
  } finally {
    saving.value = false
  }
}

async function savePrice(position: PositionWithMetrics) {
  const raw = priceDrafts[position.id]
  if (raw === undefined || raw.trim() === '') {
    return
  }

  errorMessage.value = ''

  try {
    await $fetch(`/api/investments/positions/${position.id}`, {
      method: 'PATCH',
      body: { currentPrice: Number(raw) }
    })
    delete priceDrafts[position.id]
    await refresh()
  } catch {
    errorMessage.value = 'Unable to update that price.'
  }
}

async function deletePosition(position: PositionWithMetrics) {
  errorMessage.value = ''

  try {
    await $fetch(`/api/investments/positions/${position.id}`, { method: 'DELETE' })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to delete that position.'
  }
}
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <AppPageHero
      eyebrow="Portfolio"
      :title="activeGroup ? activeGroup.label : 'Investments'"
      :subtitle="activeGroup ? activeGroup.blurb : 'Everything you hold, split across funds, shares, and contracts.'"
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Market value</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">
            {{ money(shownTotals?.marketValue) }}
          </p>
          <p class="mt-2 text-sm" :class="tone(shownTotals?.profitLoss || 0)">
            {{ signed(shownTotals?.profitLoss || 0) }} ({{ shownTotals?.profitLossPercent.toFixed(2) }}%)
          </p>
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

    <div class="grid gap-4 md:grid-cols-4">
      <PanelCard>
        <p class="eyebrow">Positions</p>
        <p class="mt-2 text-2xl font-semibold">{{ shownTotals?.positionCount }}</p>
      </PanelCard>
      <PanelCard>
        <p class="eyebrow">Invested</p>
        <p class="mt-2 text-2xl font-semibold">{{ money(shownTotals?.invested) }}</p>
      </PanelCard>
      <PanelCard>
        <p class="eyebrow">Market value</p>
        <p class="mt-2 text-2xl font-semibold">{{ money(shownTotals?.marketValue) }}</p>
      </PanelCard>
      <PanelCard>
        <p class="eyebrow">Unrealised P/L</p>
        <p class="mt-2 text-2xl font-semibold" :class="tone(shownTotals?.profitLoss || 0)">
          {{ signed(shownTotals?.profitLoss || 0) }}
        </p>
        <p class="mt-1 text-sm text-muted">{{ shownTotals?.profitLossPercent.toFixed(2) }}%</p>
      </PanelCard>
    </div>

    <!-- Overview: one card per kind -->
    <div v-if="!activeGroup" class="grid gap-6 xl:grid-cols-3">
      <PanelCard v-for="group in overview.groups" :key="group.kind" class="space-y-4">
        <div>
          <p class="eyebrow">{{ group.label }}</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ money(group.marketValue) }}</h2>
          <p class="mt-1 text-sm text-muted">{{ group.blurb }}</p>
          <p class="mt-2 text-sm font-semibold" :class="tone(group.profitLoss)">
            {{ signed(group.profitLoss) }} ({{ group.profitLossPercent.toFixed(2) }}%)
            <span class="font-normal text-muted"> · {{ group.positionCount }} positions</span>
          </p>
        </div>

        <div v-if="group.positions.length" class="space-y-2">
          <div
            v-for="position in group.positions.slice(0, 4)"
            :key="position.id"
            class="flex items-center justify-between gap-3 rounded-soft bg-surface-low px-4 py-3"
          >
            <div class="min-w-0">
              <p class="font-semibold text-ink">{{ position.symbol }}</p>
              <p class="truncate text-xs text-muted">{{ position.name || `${position.quantity} @ ${money(position.unitCost)}` }}</p>
            </div>
            <p class="shrink-0 text-sm font-semibold" :class="tone(position.profitLoss)">
              {{ position.profitLossPercent.toFixed(1) }}%
            </p>
          </div>
          <NuxtLink
            :to="`/investments/${group.kind === 'stock' ? 'stocks' : group.kind === 'option' ? 'options' : 'etf'}`"
            class="block pt-1 text-sm font-semibold text-accent"
          >
            View all →
          </NuxtLink>
        </div>
        <p v-else class="rounded-soft bg-surface-low px-4 py-6 text-center text-sm text-muted">
          Nothing here yet.
        </p>
      </PanelCard>
    </div>

    <!-- Per-kind: add form + holdings -->
    <template v-else>
      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">New position</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
            Add {{ isOption ? 'a contract' : activeGroup.label === 'ETF' ? 'a fund' : 'a holding' }}
          </h2>
        </div>
        <form class="space-y-3" @submit.prevent="addPosition">
          <div class="grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
            <input
              v-model="form.symbol"
              class="w-full rounded-2xl bg-surface-low px-4 py-3 uppercase outline-none"
              type="text"
              :placeholder="isOption ? 'SPY' : activeGroup.label === 'ETF' ? 'VWCE' : 'AAPL'"
              required
            />
            <input
              v-model="form.name"
              class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="text"
              placeholder="Name (optional)"
            />
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <label class="block">
              <span class="eyebrow">{{ isOption ? 'Contracts' : 'Quantity' }}</span>
              <input
                v-model="form.quantity"
                class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
                type="number"
                step="any"
                min="0"
                placeholder="10"
                required
              />
            </label>
            <label class="block">
              <span class="eyebrow">{{ isOption ? 'Premium paid' : 'Buy price' }}</span>
              <input
                v-model="form.unitCost"
                class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
                type="number"
                step="any"
                min="0"
                placeholder="102.50"
                required
              />
            </label>
            <label class="block">
              <span class="eyebrow">Current price</span>
              <input
                v-model="form.currentPrice"
                class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
                type="number"
                step="any"
                min="0"
                placeholder="Optional"
              />
            </label>
          </div>

          <div v-if="isOption" class="grid gap-3 md:grid-cols-3">
            <label class="block">
              <span class="eyebrow">Type</span>
              <select v-model="form.optionType" class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </label>
            <label class="block">
              <span class="eyebrow">Strike</span>
              <input
                v-model="form.strike"
                class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
                type="number"
                step="any"
                min="0"
                placeholder="450"
              />
            </label>
            <label class="block">
              <span class="eyebrow">Expiry</span>
              <input v-model="form.expiry" class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="date" />
            </label>
          </div>

          <input
            v-model="form.notes"
            class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="text"
            placeholder="Notes (optional)"
          />
          <button
            class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
            :disabled="saving || !form.symbol.trim() || !form.quantity || !form.unitCost"
          >
            Add position
          </button>
        </form>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Holdings</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
            {{ activeGroup.positionCount }} {{ activeGroup.positionCount === 1 ? 'position' : 'positions' }}
          </h2>
        </div>

        <p v-if="!activeGroup.positions.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm text-muted">
          No {{ activeGroup.label.toLowerCase() }} positions yet — add your first one above.
        </p>

        <div v-else class="space-y-3">
          <article v-for="position in activeGroup.positions" :key="position.id" class="rounded-soft bg-surface-low px-5 py-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-display text-lg font-bold tracking-[-0.03em] text-ink">{{ position.symbol }}</p>
                  <StatusPill
                    v-if="position.optionType"
                    :label="position.optionType"
                    :tone="position.optionType === 'call' ? 'teal' : 'mist'"
                  />
                  <span v-if="!position.priced" class="text-xs font-semibold text-muted">no live price</span>
                </div>
                <p v-if="position.name" class="mt-1 text-sm text-muted">{{ position.name }}</p>
                <p class="mt-1 text-sm text-muted">
                  {{ position.quantity }} {{ isOption ? 'contracts' : 'units' }} @ {{ money(position.unitCost, position.currency) }}
                  <span v-if="position.strike"> · strike {{ money(position.strike, position.currency) }}</span>
                  <span v-if="position.expiry"> · expires {{ position.expiry }}</span>
                </p>
                <p v-if="position.notes" class="mt-1 text-sm text-muted">{{ position.notes }}</p>
              </div>

              <div class="text-right">
                <p class="font-display text-xl font-bold tracking-[-0.03em] text-ink">
                  {{ money(position.marketValue, position.currency) }}
                </p>
                <p class="mt-1 text-sm font-semibold" :class="tone(position.profitLoss)">
                  {{ signed(position.profitLoss, position.currency) }} ({{ position.profitLossPercent.toFixed(2) }}%)
                </p>
                <p class="mt-1 text-xs text-muted">Invested {{ money(position.invested, position.currency) }}</p>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <input
                  v-model="priceDrafts[position.id]"
                  class="w-36 rounded-full bg-surface px-4 py-2 text-sm outline-none"
                  type="number"
                  step="any"
                  min="0"
                  :placeholder="position.currentPrice !== null ? `Price ${position.currentPrice}` : 'Set price'"
                  @keyup.enter="savePrice(position)"
                />
                <button
                  class="rounded-full bg-surface px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40"
                  type="button"
                  :disabled="!priceDrafts[position.id]"
                  @click="savePrice(position)"
                >
                  Update price
                </button>
              </div>
              <button class="text-xs font-semibold text-rose-700" type="button" @click="deletePosition(position)">
                Delete
              </button>
            </div>
          </article>
        </div>
      </PanelCard>
    </template>
  </div>
</template>
