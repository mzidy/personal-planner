<script setup lang="ts">
import { ArrowRight, Pencil, Plus, X } from 'lucide-vue-next'
import type { CurrencyTotals, ExchangeView } from '~~/shared/types/trades'

const props = defineProps<{ exchanges: ExchangeView[] }>()
const emit = defineEmits<{ add: []; exchange: [action: 'close' | 'edit' | 'remove', item: ExchangeView] }>()

const { money, signedMoney, signed, points, tone, shares, day, totals } = useTradeFormat()

const priced = computed(() => props.exchanges.filter(item => item.result))
const ahead = computed(() => priced.value.filter(item => item.result!.edgePoints > 0).length)
const averageEdge = computed(() =>
  priced.value.length ? priced.value.reduce((sum, item) => sum + item.result!.edgePoints, 0) / priced.value.length : null
)
const edgeTotals = computed(() => {
  const sums: CurrencyTotals = {}
  for (const item of priced.value) {
    if (item.result!.edgeValue !== null) {
      sums[item.bought.currency] = (sums[item.bought.currency] ?? 0) + item.result!.edgeValue
    }
  }
  return sums
})
</script>

<template>
  <PanelCard class="flex min-w-0 flex-col gap-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="eyebrow">Exchange stocks</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ exchanges.length }} active</h2>
        <p class="mt-1 text-xs text-muted">
          <template v-if="priced.length">
            {{ ahead }} of {{ priced.length }} ahead of the stock sold · average
            <span class="font-semibold" :class="tone(averageEdge)">{{ points(averageEdge) }}</span>
            <template v-if="Object.keys(edgeTotals).length">
              · <span class="font-semibold" :class="tone(Object.values(edgeTotals)[0])">{{ totals(edgeTotals) }}</span>
            </template>
          </template>
          <template v-else>One stock sold, another bought with the money — and whether the switch paid off.</template>
        </p>
      </div>
      <button
        class="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white"
        @click="emit('add')"
      >
        <Plus class="h-3.5 w-3.5" /> Add
      </button>
    </div>

    <p v-if="!exchanges.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm leading-6 text-muted">
      No active exchanges. Add one to follow the bought stock against the one you sold.
    </p>

    <ul v-else class="space-y-3">
      <li v-for="item in exchanges" :key="item.id" class="rounded-soft bg-surface-low p-4">
        <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-3">
          <div class="min-w-0">
            <p class="eyebrow text-rose-700">Sold · {{ day(item.sold.date) }}</p>
            <p class="mt-1 font-display text-lg font-bold tracking-[-0.02em]">{{ item.sold.symbol }}</p>
            <p class="truncate text-xs text-muted">{{ item.sold.name }}</p>
            <p class="mt-1 text-xs tabular-nums">{{ shares(item.sold.quantity) }} × {{ money(item.sold.price, item.sold.currency) }}</p>
            <p class="text-xs tabular-nums text-muted">
              Now {{ money(item.soldNow, item.sold.currency) }}
              <span v-if="item.result" :class="tone(item.result.keptReturnPercent)">{{ signed(item.result.keptReturnPercent) }}</span>
            </p>
          </div>
          <ArrowRight class="mt-6 h-4 w-4 shrink-0 text-muted" />
          <div class="min-w-0">
            <p class="eyebrow text-emerald-700">Bought · {{ day(item.bought.date) }}</p>
            <p class="mt-1 font-display text-lg font-bold tracking-[-0.02em]">{{ item.bought.symbol }}</p>
            <p class="truncate text-xs text-muted">{{ item.bought.name }}</p>
            <p class="mt-1 text-xs tabular-nums">{{ shares(item.bought.quantity) }} × {{ money(item.bought.price, item.bought.currency) }}</p>
            <p class="text-xs tabular-nums text-muted">
              Now {{ money(item.boughtNow, item.bought.currency) }}
              <span v-if="item.result" :class="tone(item.result.boughtReturnPercent)">{{ signed(item.result.boughtReturnPercent) }}</span>
            </p>
          </div>
        </div>

        <p v-if="item.note" class="mt-2 text-xs italic leading-5 text-muted">{{ item.note }}</p>

        <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-outline/10 pt-3">
          <p v-if="item.result" class="text-sm">
            <span class="text-muted">Edge</span>
            <span class="ml-1 font-display font-bold tabular-nums" :class="tone(item.result.edgePoints)">{{ points(item.result.edgePoints) }}</span>
            <span v-if="item.result.edgeValue !== null" class="ml-1 text-xs tabular-nums" :class="tone(item.result.edgeValue)">
              {{ signedMoney(item.result.edgeValue, item.bought.currency) }}
            </span>
            <span class="ml-1 text-xs text-muted">· {{ item.result.days }} d</span>
          </p>
          <p v-else class="text-xs text-rose-700">{{ item.quoteError }}</p>
          <div class="flex items-center gap-1">
            <button
              class="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold transition hover:bg-surface-high"
              @click="emit('exchange', 'close', item)"
            >
              Close
            </button>
            <button class="rounded-full p-1.5 text-muted transition hover:bg-surface hover:text-ink" title="Edit" @click="emit('exchange', 'edit', item)">
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button
              class="rounded-full p-1.5 text-muted transition hover:bg-surface hover:text-rose-700"
              title="Delete"
              @click="emit('exchange', 'remove', item)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </li>
    </ul>
  </PanelCard>
</template>
