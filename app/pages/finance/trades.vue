<script setup lang="ts">
import type { ExchangeView, StockExchangeRecord, TradeLeg, TradeView, TradesView } from '~~/shared/types/trades'
import type { TradeDialogMode } from '~/composables/useTradeFormat'

definePageMeta({
  middleware: 'protected'
})

/** Live prices refresh this often, and only while a held stock's market is open. */
const REFRESH_MS = 5 * 60 * 1000

const { data: view, refresh } = await usePlannerFetch<TradesView>('trades', '/api/trades')

const activeExchanges = computed(() => view.value?.exchanges.filter(item => item.closedDate === null) || [])
const openTrades = computed(() => view.value?.trades.filter(item => item.exitPrice === null) || [])
const closedExchanges = computed(() =>
  (view.value?.exchanges.filter(item => item.closedDate !== null) || []).sort((a, b) => b.closedDate!.localeCompare(a.closedDate!))
)
const closedTrades = computed(() =>
  (view.value?.trades.filter(item => item.exitDate !== null) || []).sort((a, b) => b.exitDate!.localeCompare(a.exitDate!))
)

const updated = computed(() =>
  view.value ? new Date(view.value.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
)

type DialogState =
  | { kind: 'exchange'; mode: TradeDialogMode; item: ExchangeView | null }
  | { kind: 'trade'; mode: TradeDialogMode; item: TradeView | null }

const dialog = ref<DialogState | null>(null)
const errorMessage = ref('')

function messageOf(error: unknown, fallback: string) {
  const fetchError = error as { data?: { statusMessage?: string; message?: string } }
  return fetchError?.data?.statusMessage || fetchError?.data?.message || fallback
}

function onSaved(next: TradesView) {
  view.value = next
  dialog.value = null
  errorMessage.value = ''
}

const legInput = (leg: TradeLeg) => ({ symbol: leg.symbol, quantity: leg.quantity, price: leg.price, date: leg.date })

function exchangeInput(item: StockExchangeRecord) {
  return {
    sold: legInput(item.sold),
    bought: legInput(item.bought),
    note: item.note,
    closedDate: item.closedDate,
    closedBoughtPrice: item.closedBoughtPrice,
    closedSoldPrice: item.closedSoldPrice
  }
}

async function send(request: () => Promise<TradesView>, fallback: string) {
  errorMessage.value = ''
  try {
    view.value = await request()
  } catch (error) {
    errorMessage.value = messageOf(error, fallback)
  }
}

function onExchange(action: 'close' | 'edit' | 'reopen' | 'remove', item: ExchangeView) {
  const pair = `${item.sold.symbol} → ${item.bought.symbol}`
  if (action === 'close' || action === 'edit') {
    dialog.value = { kind: 'exchange', mode: action, item }
  } else if (action === 'reopen') {
    const body = { ...exchangeInput(item), closedDate: null, closedBoughtPrice: null, closedSoldPrice: null }
    send(() => $fetch<TradesView>(`/api/trades/exchanges/${item.id}`, { method: 'PUT', body }), `${pair} could not be reopened.`)
  } else if (window.confirm(`Delete the exchange ${pair}? This cannot be undone.`)) {
    send(() => $fetch<TradesView>(`/api/trades/exchanges/${item.id}`, { method: 'DELETE' }), `${pair} could not be deleted.`)
  }
}

function onTrade(action: 'close' | 'edit' | 'reopen' | 'remove', item: TradeView) {
  if (action === 'close' || action === 'edit') {
    dialog.value = { kind: 'trade', mode: action, item }
  } else if (action === 'reopen') {
    const { symbol, quantity, entryPrice, entryDate, targetPrice, stopPrice, note } = item
    const body = { symbol, quantity, entryPrice, entryDate, targetPrice, stopPrice, note, exitPrice: null, exitDate: null }
    send(() => $fetch<TradesView>(`/api/trades/positions/${item.id}`, { method: 'PUT', body }), `${symbol} could not be reopened.`)
  } else if (window.confirm(`Delete the ${item.symbol} trade? This cannot be undone.`)) {
    send(() => $fetch<TradesView>(`/api/trades/positions/${item.id}`, { method: 'DELETE' }), `${item.symbol} could not be deleted.`)
  }
}

let timer: ReturnType<typeof setInterval> | null = null

function onVisibility() {
  if (
    document.visibilityState === 'visible' &&
    view.value?.marketOpen &&
    Date.now() - new Date(view.value.fetchedAt).getTime() > REFRESH_MS
  ) {
    refresh()
  }
}

onMounted(() => {
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && view.value?.marketOpen && !dialog.value) {
      refresh()
    }
  }, REFRESH_MS)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Trading desk"
      title="Active trades"
      subtitle="Stocks exchanged for others and single positions, priced live, with the record of how each one ended."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Active</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ activeExchanges.length + openTrades.length }}</p>
          <p class="mt-2 text-sm text-muted">
            {{ activeExchanges.length }} {{ activeExchanges.length === 1 ? 'exchange' : 'exchanges' }} ·
            {{ openTrades.length }} {{ openTrades.length === 1 ? 'trade' : 'trades' }}
          </p>
          <p v-if="view" class="mt-1 text-xs text-muted">
            <template v-if="view.marketOpen"><span class="font-semibold text-emerald-700">Live</span> · {{ updated }}</template>
            <template v-else>Markets closed · prices as of {{ updated }}</template>
          </p>
        </PanelCard>
      </template>
    </AppPageHero>

    <FinanceTabs />

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</p>

    <template v-if="view">
      <div class="grid gap-6 xl:grid-cols-2">
        <TradesExchangeCard
          :exchanges="activeExchanges"
          @add="dialog = { kind: 'exchange', mode: 'add', item: null }"
          @exchange="onExchange"
        />
        <TradesOpenCard :trades="openTrades" @add="dialog = { kind: 'trade', mode: 'add', item: null }" @trade="onTrade" />
      </div>

      <TradesTrackRecord
        :exchanges="closedExchanges"
        :trades="closedTrades"
        :stats="view.stats"
        @exchange="onExchange"
        @trade="onTrade"
      />
    </template>
    <p v-else class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm text-muted">Active trades could not be loaded.</p>

    <TradesExchangeDialog
      v-if="dialog?.kind === 'exchange'"
      :mode="dialog.mode"
      :exchange="dialog.item"
      @close="dialog = null"
      @saved="onSaved"
    />
    <TradesTradeDialog
      v-if="dialog?.kind === 'trade'"
      :mode="dialog.mode"
      :trade="dialog.item"
      @close="dialog = null"
      @saved="onSaved"
    />
  </div>
</template>
