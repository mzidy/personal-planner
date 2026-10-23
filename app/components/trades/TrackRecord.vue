<script setup lang="ts">
import { Pencil, RotateCcw, X } from 'lucide-vue-next'
import type { ExchangeStats, ExchangeView, TradeStats, TradeView } from '~~/shared/types/trades'

const props = defineProps<{
  exchanges: ExchangeView[]
  trades: TradeView[]
  stats: { exchanges: ExchangeStats; trades: TradeStats }
}>()

const emit = defineEmits<{
  exchange: [action: 'edit' | 'reopen' | 'remove', item: ExchangeView]
  trade: [action: 'edit' | 'reopen' | 'remove', item: TradeView]
}>()

const { money, signedMoney, signed, points, tone, shares, day, totals } = useTradeFormat()

const tab = ref<'exchanges' | 'trades'>('exchanges')

const days = (value: number | null) => (value === null ? '—' : `${Math.round(value)} d`)
const rate = (value: number | null) => (value === null ? '—' : `${value.toFixed(value % 1 ? 1 : 0)}%`)

interface Tile {
  label: string
  value: string
  detail?: string
  tone?: string
}

const tiles = computed<Tile[]>(() => {
  if (tab.value === 'exchanges') {
    const stats = props.stats.exchanges
    return [
      { label: 'Closed', value: String(stats.count), detail: stats.count === 1 ? 'exchange' : 'exchanges' },
      { label: 'Win rate', value: rate(stats.winRate), detail: `${stats.wins} beat keeping the stock` },
      { label: 'Average edge', value: points(stats.averageEdgePoints), tone: tone(stats.averageEdgePoints) },
      { label: 'Edge in money', value: totals(stats.edgeValue), tone: tone(Object.values(stats.edgeValue)[0]) },
      {
        label: 'Bought stocks',
        value: signed(stats.averageBoughtReturnPercent, '%', 1),
        detail: 'average return',
        tone: tone(stats.averageBoughtReturnPercent)
      },
      {
        label: 'Sold stocks',
        value: signed(stats.averageKeptReturnPercent, '%', 1),
        detail: 'had you kept them',
        tone: tone(stats.averageKeptReturnPercent)
      },
      { label: 'Average length', value: days(stats.averageDays) },
      {
        label: 'Best · worst',
        value: stats.best ? `${points(stats.best.value)} · ${points(stats.worst?.value)}` : '—',
        detail: stats.best ? `${stats.best.label} · ${stats.worst?.label}` : undefined
      }
    ]
  }
  const stats = props.stats.trades
  return [
    { label: 'Closed', value: String(stats.count), detail: stats.count === 1 ? 'trade' : 'trades' },
    { label: 'Win rate', value: rate(stats.winRate), detail: `${stats.wins} closed in profit` },
    { label: 'Realized', value: totals(stats.pnl), tone: tone(Object.values(stats.pnl)[0]) },
    { label: 'Average return', value: signed(stats.averageReturnPercent), tone: tone(stats.averageReturnPercent) },
    {
      label: 'Average win / loss',
      value: stats.count ? `${signed(stats.averageWinPercent, '%', 1)} / ${signed(stats.averageLossPercent, '%', 1)}` : '—'
    },
    { label: 'Profit factor', value: stats.profitFactor === null ? '—' : stats.profitFactor.toFixed(2), detail: 'gains ÷ losses' },
    { label: 'Average hold', value: days(stats.averageDays) },
    {
      label: 'Best · worst',
      value: stats.best ? `${signed(stats.best.value, '%', 1)} · ${signed(stats.worst?.value, '%', 1)}` : '—',
      detail: stats.best ? `${stats.best.label} · ${stats.worst?.label}` : undefined
    }
  ]
})
</script>

<template>
  <PanelCard class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="eyebrow">Track record</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">History and performance</h2>
        <p class="mt-1 text-sm text-muted">Every closed exchange and trade, scored on its prices and dates.</p>
      </div>
      <div class="grid grid-cols-2 gap-1 rounded-2xl bg-surface-low p-1 text-xs font-semibold" role="tablist">
        <button
          v-for="option in (['exchanges', 'trades'] as const)"
          :key="option"
          type="button"
          role="tab"
          :aria-selected="tab === option"
          class="rounded-xl px-4 py-2 transition-colors"
          :class="tab === option ? 'bg-ink text-white' : 'text-muted hover:text-ink'"
          @click="tab = option"
        >
          {{ option === 'exchanges' ? 'Exchanges' : 'Trades' }} · {{ option === 'exchanges' ? exchanges.length : trades.length }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div v-for="tile in tiles" :key="tile.label" class="min-w-0 rounded-soft bg-surface-low px-4 py-3">
        <p class="eyebrow">{{ tile.label }}</p>
        <p class="mt-1 truncate font-display text-xl font-bold tabular-nums tracking-[-0.03em]" :class="tile.tone">{{ tile.value }}</p>
        <p v-if="tile.detail" class="truncate text-xs text-muted">{{ tile.detail }}</p>
      </div>
    </div>

    <template v-if="tab === 'exchanges'">
      <p v-if="!exchanges.length" class="rounded-soft bg-surface-low px-4 py-6 text-center text-sm text-muted">
        Closed exchanges land here, with how the bought stock did against the one you sold.
      </p>
      <ul v-else class="divide-y divide-outline/10">
        <li v-for="item in exchanges" :key="item.id" class="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
          <div class="min-w-0 flex-1 basis-48">
            <p class="font-semibold">{{ item.sold.symbol }} → {{ item.bought.symbol }}</p>
            <p class="text-xs text-muted">
              {{ day(item.sold.date) }} → {{ day(item.closedDate) }}<template v-if="item.result"> · {{ item.result.days }} d</template>
            </p>
          </div>
          <p v-if="item.result" class="text-xs tabular-nums text-muted">
            {{ item.bought.symbol }} <span :class="tone(item.result.boughtReturnPercent)">{{ signed(item.result.boughtReturnPercent, '%', 1) }}</span>
            · {{ item.sold.symbol }} kept <span :class="tone(item.result.keptReturnPercent)">{{ signed(item.result.keptReturnPercent, '%', 1) }}</span>
          </p>
          <div v-if="item.result" class="w-28 text-right">
            <p class="font-display font-bold tabular-nums" :class="tone(item.result.edgePoints)">{{ points(item.result.edgePoints) }}</p>
            <p v-if="item.result.edgeValue !== null" class="text-xs tabular-nums" :class="tone(item.result.edgeValue)">
              {{ signedMoney(item.result.edgeValue, item.bought.currency) }}
            </p>
          </div>
          <div class="flex items-center gap-0.5">
            <button class="rounded-full p-1.5 text-muted transition hover:bg-surface-low hover:text-ink" title="Edit" @click="emit('exchange', 'edit', item)">
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button
              class="rounded-full p-1.5 text-muted transition hover:bg-surface-low hover:text-ink"
              title="Reopen as active"
              @click="emit('exchange', 'reopen', item)"
            >
              <RotateCcw class="h-3.5 w-3.5" />
            </button>
            <button
              class="rounded-full p-1.5 text-muted transition hover:bg-surface-low hover:text-rose-700"
              title="Delete"
              @click="emit('exchange', 'remove', item)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </li>
      </ul>
    </template>

    <template v-else>
      <p v-if="!trades.length" class="rounded-soft bg-surface-low px-4 py-6 text-center text-sm text-muted">
        Closed trades land here with their realized result.
      </p>
      <ul v-else class="divide-y divide-outline/10">
        <li v-for="item in trades" :key="item.id" class="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
          <div class="min-w-0 flex-1 basis-48">
            <p class="font-semibold">{{ item.symbol }}</p>
            <p class="text-xs text-muted">
              {{ day(item.entryDate) }} → {{ day(item.exitDate) }}<template v-if="item.result"> · {{ item.result.days }} d</template>
            </p>
          </div>
          <p class="text-xs tabular-nums text-muted">
            {{ shares(item.quantity) }} × {{ money(item.entryPrice, item.currency) }} → {{ money(item.exitPrice, item.currency) }}
          </p>
          <div v-if="item.result" class="w-28 text-right">
            <p class="font-display font-bold tabular-nums" :class="tone(item.result.pnl)">{{ signedMoney(item.result.pnl, item.currency) }}</p>
            <p class="text-xs tabular-nums" :class="tone(item.result.pnlPercent)">{{ signed(item.result.pnlPercent) }}</p>
          </div>
          <div class="flex items-center gap-0.5">
            <button class="rounded-full p-1.5 text-muted transition hover:bg-surface-low hover:text-ink" title="Edit" @click="emit('trade', 'edit', item)">
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button
              class="rounded-full p-1.5 text-muted transition hover:bg-surface-low hover:text-ink"
              title="Reopen as active"
              @click="emit('trade', 'reopen', item)"
            >
              <RotateCcw class="h-3.5 w-3.5" />
            </button>
            <button
              class="rounded-full p-1.5 text-muted transition hover:bg-surface-low hover:text-rose-700"
              title="Delete"
              @click="emit('trade', 'remove', item)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </li>
      </ul>
    </template>
  </PanelCard>
</template>
