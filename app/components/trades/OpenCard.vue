<script setup lang="ts">
import { Pencil, Plus, X } from 'lucide-vue-next'
import type { CurrencyTotals, TradeView } from '~~/shared/types/trades'

const props = defineProps<{ trades: TradeView[] }>()
const emit = defineEmits<{ add: []; trade: [action: 'close' | 'edit' | 'remove', item: TradeView] }>()

const { money, signedMoney, signed, tone, shares, day, totals } = useTradeFormat()

const priced = computed(() => props.trades.filter(item => item.result))
const winning = computed(() => priced.value.filter(item => item.result!.pnl > 0).length)
const unrealized = computed(() => {
  const sums: CurrencyTotals = {}
  for (const item of priced.value) {
    sums[item.currency] = (sums[item.currency] ?? 0) + item.result!.pnl
  }
  return sums
})
</script>

<template>
  <PanelCard class="flex min-w-0 flex-col gap-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="eyebrow">Open trades</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ trades.length }} open</h2>
        <p class="mt-1 text-xs text-muted">
          <template v-if="priced.length">
            {{ winning }} of {{ priced.length }} in profit · unrealized
            <span class="font-semibold" :class="tone(Object.values(unrealized)[0])">{{ totals(unrealized) }}</span>
          </template>
          <template v-else>Single positions from entry to exit, with an optional target and stop.</template>
        </p>
      </div>
      <button
        class="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white"
        @click="emit('add')"
      >
        <Plus class="h-3.5 w-3.5" /> Add
      </button>
    </div>

    <p v-if="!trades.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm leading-6 text-muted">
      No open trades. Add a position to follow it live until you close it.
    </p>

    <ul v-else class="space-y-3">
      <li v-for="item in trades" :key="item.id" class="rounded-soft bg-surface-low p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-display text-lg font-bold tracking-[-0.02em]">{{ item.symbol }}</p>
            <p class="truncate text-xs text-muted">{{ item.name }}</p>
            <p class="mt-1 text-xs tabular-nums">
              {{ shares(item.quantity) }} × {{ money(item.entryPrice, item.currency) }}
              <span class="text-muted">· {{ day(item.entryDate) }}<template v-if="item.result"> · {{ item.result.days }} d</template></span>
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p class="font-display text-lg font-bold tabular-nums">{{ money(item.now, item.currency) }}</p>
            <p v-if="item.result" class="text-xs tabular-nums" :class="tone(item.result.pnl)">
              {{ signedMoney(item.result.pnl, item.currency) }} ({{ signed(item.result.pnlPercent) }})
            </p>
            <p v-else class="max-w-[10rem] text-xs text-rose-700">{{ item.quoteError }}</p>
          </div>
        </div>

        <!-- Where the price sits between the stop and the target. -->
        <div v-if="item.result && (item.stopPrice !== null || item.targetPrice !== null)" class="mt-3 space-y-1.5">
          <div v-if="item.result.rangeProgress !== null" class="relative h-1.5 rounded-full bg-gradient-to-r from-rose-200 via-surface-high to-emerald-200">
            <span
              class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink"
              :style="{ left: `${item.result.rangeProgress * 100}%` }"
            />
          </div>
          <div class="flex flex-wrap justify-between gap-x-3 text-[11px] tabular-nums text-muted">
            <span v-if="item.stopPrice !== null">
              Stop {{ money(item.stopPrice, item.currency) }} <span class="text-rose-700">{{ signed(item.result.toStopPercent) }}</span>
            </span>
            <span v-if="item.result.rMultiple !== null" class="font-semibold text-ink">{{ signed(item.result.rMultiple, 'R', 1) }}</span>
            <span v-if="item.targetPrice !== null">
              Target {{ money(item.targetPrice, item.currency) }} <span class="text-emerald-700">{{ signed(item.result.toTargetPercent) }}</span>
            </span>
          </div>
        </div>

        <p v-if="item.note" class="mt-2 text-xs italic leading-5 text-muted">{{ item.note }}</p>

        <div class="mt-3 flex items-center justify-end gap-1 border-t border-outline/10 pt-3">
          <button
            class="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold transition hover:bg-surface-high"
            @click="emit('trade', 'close', item)"
          >
            Close
          </button>
          <button class="rounded-full p-1.5 text-muted transition hover:bg-surface hover:text-ink" title="Edit" @click="emit('trade', 'edit', item)">
            <Pencil class="h-3.5 w-3.5" />
          </button>
          <button
            class="rounded-full p-1.5 text-muted transition hover:bg-surface hover:text-rose-700"
            title="Delete"
            @click="emit('trade', 'remove', item)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    </ul>
  </PanelCard>
</template>
