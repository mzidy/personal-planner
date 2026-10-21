<script setup lang="ts">
import { ChevronDown, ChevronUp, X } from 'lucide-vue-next'
import type { WatchlistItem } from '~~/shared/types/watchlist'

const props = defineProps<{
  item: WatchlistItem
  first: boolean
  last: boolean
}>()

const emit = defineEmits<{ select: []; move: [direction: -1 | 1]; remove: [] }>()

/** Index levels (^GSPC and the like) are points, not prices, so they get no currency sign. */
function money(value: number | null, currency: string) {
  if (value === null) {
    return '—'
  }
  if (props.item.symbol.startsWith('^')) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value)
  }
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

function signed(value: number | null, suffix = '') {
  if (value === null) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`
}

function tone(value: number | null) {
  if (!value) {
    return 'text-muted'
  }
  return value > 0 ? 'text-emerald-700' : 'text-rose-700'
}
</script>

<template>
  <li class="flex items-center gap-2 rounded-soft bg-surface-low px-2 py-2.5 sm:gap-3 sm:px-3">
    <div class="flex shrink-0 flex-col">
      <button
        class="rounded-md p-0.5 text-muted transition hover:bg-surface hover:text-ink disabled:opacity-25"
        :disabled="first"
        :title="`Move ${item.symbol} up`"
        @click="emit('move', -1)"
      >
        <ChevronUp class="h-4 w-4" />
      </button>
      <button
        class="rounded-md p-0.5 text-muted transition hover:bg-surface hover:text-ink disabled:opacity-25"
        :disabled="last"
        :title="`Move ${item.symbol} down`"
        @click="emit('move', 1)"
      >
        <ChevronDown class="h-4 w-4" />
      </button>
    </div>

    <button class="min-w-0 flex-1 text-left" :title="`Chart ${item.symbol}`" @click="emit('select')">
      <span class="block font-display text-base font-bold tracking-[-0.02em]">{{ item.symbol }}</span>
      <span class="block truncate text-xs text-muted">{{ item.error || item.name }}</span>
      <span v-if="!item.error" class="block text-[11px] text-muted sm:hidden">
        200-day {{ money(item.ma200, item.currency) }}
        <span :class="tone(item.gapToMa200Percent)">{{ signed(item.gapToMa200Percent, '%') }}</span>
      </span>
    </button>

    <div class="shrink-0 text-right">
      <p class="font-display text-base font-bold tabular-nums">{{ money(item.price, item.currency) }}</p>
      <p class="text-xs tabular-nums" :class="tone(item.change)">
        {{ signed(item.change) }} ({{ signed(item.changePercent, '%') }})
      </p>
    </div>

    <div class="hidden w-28 shrink-0 text-right sm:block">
      <p class="text-xs text-muted">200-day</p>
      <p class="text-sm font-semibold tabular-nums">{{ money(item.ma200, item.currency) }}</p>
      <p class="text-[11px] tabular-nums" :class="tone(item.gapToMa200Percent)">{{ signed(item.gapToMa200Percent, '%') }}</p>
    </div>

    <button
      class="shrink-0 rounded-full p-1.5 text-muted transition hover:bg-surface hover:text-rose-700"
      :title="`Remove ${item.symbol}`"
      @click="emit('remove')"
    >
      <X class="h-3.5 w-3.5" />
    </button>
  </li>
</template>
