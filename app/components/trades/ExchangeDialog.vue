<script setup lang="ts">
import type { ExchangeView, StockExchangeRecord, TradeLeg, TradesView } from '~~/shared/types/trades'
import { exchangeResult } from '~~/shared/utils/trades'
import type { TradeDialogMode } from '~/composables/useTradeFormat'

const props = defineProps<{ mode: TradeDialogMode; exchange: ExchangeView | null }>()
const emit = defineEmits<{ close: []; saved: [view: TradesView] }>()

const { money, signedMoney, signed, points, tone, shares, day, parseAmount, localToday } = useTradeFormat()
const { watchClose } = useCloseLookup()

const source = props.exchange
const today = localToday()

function legForm(leg?: TradeLeg) {
  return {
    symbol: leg?.symbol ?? '',
    quantity: leg ? String(leg.quantity) : '',
    price: leg ? String(leg.price) : '',
    date: leg?.date ?? today
  }
}

const form = reactive({
  sold: legForm(source?.sold),
  bought: legForm(source?.bought),
  note: source?.note ?? '',
  closedDate: source?.closedDate ?? today,
  closedBoughtPrice: source?.closedBoughtPrice != null ? String(source.closedBoughtPrice) : '',
  closedSoldPrice: source?.closedSoldPrice != null ? String(source.closedSoldPrice) : ''
})

/** Closing fields: always when closing, and when editing an exchange that is already closed. */
const closing = computed(() => props.mode === 'close' || (props.mode === 'edit' && source?.closedDate != null))
const title = computed(() => {
  if (props.mode === 'add') {
    return 'New exchange'
  }
  const pair = `${source?.sold.symbol} → ${source?.bought.symbol}`
  return props.mode === 'close' ? `Close ${pair}` : `Edit ${pair}`
})

// What each stock closed at on the chosen day: shown as a hint, and filled in while the field is
// empty or still holds the previous suggestion, so changing the date moves an untouched price along.
const closes = reactive<Record<string, string>>({})
const currencies = reactive<Record<string, string>>({})
const suggested = new Map<string, string>()

function prefill<K extends string>(key: string, symbol: () => string, date: () => string, target: Record<K, string>, field: K) {
  watchClose(symbol, date, close => {
    closes[key] = `${close.symbol} closed at ${money(close.close, close.currency)} on ${day(close.date)}`
    currencies[key] = close.currency
    const value = String(close.close)
    if (!target[field].trim() || target[field] === suggested.get(key)) {
      target[field] = value
      suggested.set(key, value)
    }
  })
}

if (props.mode !== 'close') {
  prefill('sold', () => form.sold.symbol, () => form.sold.date, form.sold, 'price')
  prefill('bought', () => form.bought.symbol, () => form.bought.date, form.bought, 'price')
}
prefill('closedBought', () => (closing.value ? form.bought.symbol : ''), () => form.closedDate, form, 'closedBoughtPrice')
prefill('closedSold', () => (closing.value ? form.sold.symbol : ''), () => form.closedDate, form, 'closedSoldPrice')

/** The sale's proceeds, and how many whole shares of the bought stock they pay for. */
const proceeds = computed(() => {
  const quantity = parseAmount(form.sold.quantity)
  const price = parseAmount(form.sold.price)
  if (!quantity || !price) {
    return null
  }
  const amount = quantity * price
  const boughtPrice = parseAmount(form.bought.price)
  return { amount, affordable: boughtPrice ? Math.floor(amount / boughtPrice) : null }
})

function leg(fields: ReturnType<typeof legForm>) {
  return {
    symbol: fields.symbol.trim().toUpperCase(),
    quantity: parseAmount(fields.quantity),
    price: parseAmount(fields.price),
    date: fields.date
  }
}

const payload = computed(() => ({
  sold: leg(form.sold),
  bought: leg(form.bought),
  note: form.note.trim(),
  closedDate: closing.value ? form.closedDate || null : null,
  closedBoughtPrice: closing.value ? parseAmount(form.closedBoughtPrice) : null,
  closedSoldPrice: closing.value ? parseAmount(form.closedSoldPrice) : null
}))

/** How the exchange ends at the prices typed so far, before it is saved. */
const preview = computed(() => {
  const { sold, bought, closedDate, closedSoldPrice, closedBoughtPrice } = payload.value
  if (!closing.value || !source || !closedDate || !closedSoldPrice || !closedBoughtPrice) {
    return null
  }
  if (!sold.price || !sold.quantity || !bought.price || !bought.quantity) {
    return null
  }
  const record: StockExchangeRecord = {
    ...source,
    sold: { ...source.sold, ...sold, price: sold.price, quantity: sold.quantity },
    bought: { ...source.bought, ...bought, price: bought.price, quantity: bought.quantity },
    closedDate
  }
  return exchangeResult(record, closedSoldPrice, closedBoughtPrice, closedDate)
})

const saving = ref(false)
const errorMessage = ref('')

async function save() {
  const body = payload.value
  const legs = [body.sold, body.bought]
  if (legs.some(item => !item.symbol || item.quantity === null || item.price === null || !item.date)) {
    errorMessage.value = 'Fill in the ticker, lot, price and date of both stocks.'
    return
  }
  if (closing.value && (!body.closedDate || body.closedBoughtPrice === null || body.closedSoldPrice === null)) {
    errorMessage.value = 'Closing needs the date and both prices.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const view = source
      ? await $fetch<TradesView>(`/api/trades/exchanges/${source.id}`, { method: 'PUT', body })
      : await $fetch<TradesView>('/api/trades/exchanges', { method: 'POST', body })
    emit('saved', view)
  } catch (error) {
    const fetchError = error as { data?: { statusMessage?: string; message?: string } }
    errorMessage.value = fetchError?.data?.statusMessage || fetchError?.data?.message || 'The exchange could not be saved.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <TradesDialog eyebrow="Exchange stocks" :title="title" @close="emit('close')">
    <form class="space-y-5" @submit.prevent="save">
      <template v-if="mode !== 'close'">
        <section class="space-y-3">
          <p class="text-sm font-semibold text-rose-700">Sold</p>
          <div class="grid gap-3 sm:grid-cols-4">
            <TradesField v-model="form.sold.symbol" label="Ticker" kind="ticker" placeholder="NBIS" />
            <TradesField v-model="form.sold.quantity" label="Lot" kind="amount" placeholder="10" />
            <TradesField v-model="form.sold.price" label="Price" kind="amount" placeholder="120.50" />
            <TradesField v-model="form.sold.date" label="Date" kind="date" />
          </div>
          <p v-if="closes.sold" class="text-xs text-muted">{{ closes.sold }}</p>
        </section>

        <section class="space-y-3">
          <p class="text-sm font-semibold text-emerald-700">Bought with that money</p>
          <div class="grid gap-3 sm:grid-cols-4">
            <TradesField v-model="form.bought.symbol" label="Ticker" kind="ticker" placeholder="HOOD" />
            <TradesField v-model="form.bought.quantity" label="Lot" kind="amount" placeholder="12" />
            <TradesField v-model="form.bought.price" label="Price" kind="amount" placeholder="95.00" />
            <TradesField v-model="form.bought.date" label="Date" kind="date" />
          </div>
          <p v-if="closes.bought" class="text-xs text-muted">{{ closes.bought }}</p>
          <p v-if="proceeds" class="text-xs text-muted">
            The sale raised {{ money(proceeds.amount, currencies.sold || source?.sold.currency) }}<template v-if="proceeds.affordable !== null">
              — enough for {{ shares(proceeds.affordable) }} shares at this price.
              <button
                v-if="String(proceeds.affordable) !== form.bought.quantity"
                type="button"
                class="font-semibold text-ink underline underline-offset-2"
                @click="form.bought.quantity = String(proceeds.affordable)"
              >
                Use {{ shares(proceeds.affordable) }}
              </button>
            </template>
          </p>
        </section>
      </template>

      <section v-if="closing" class="space-y-3" :class="{ 'border-t border-outline/10 pt-5': mode !== 'close' }">
        <p v-if="mode === 'close'" class="text-sm leading-6 text-muted">
          Closing freezes the result: {{ source?.bought.symbol }} at its exit price against what
          {{ source?.sold.symbol }} closed at that day, as if you had kept it.
        </p>
        <p v-else class="text-sm font-semibold">Closed</p>
        <div class="grid gap-3 sm:grid-cols-3">
          <TradesField v-model="form.closedDate" label="Close date" kind="date" />
          <TradesField v-model="form.closedBoughtPrice" :label="`${form.bought.symbol || 'Bought'} exit price`" kind="amount" />
          <TradesField v-model="form.closedSoldPrice" :label="`${form.sold.symbol || 'Sold'} that day`" kind="amount" />
        </div>
        <p v-if="closes.closedBought || closes.closedSold" class="text-xs leading-5 text-muted">
          {{ [closes.closedBought, closes.closedSold].filter(Boolean).join(' · ') }}
        </p>

        <div v-if="preview" class="grid grid-cols-3 gap-2 rounded-soft bg-surface-low p-4 text-center">
          <div>
            <p class="eyebrow">{{ source?.bought.symbol }}</p>
            <p class="mt-1 font-display text-lg font-bold tabular-nums" :class="tone(preview.boughtReturnPercent)">
              {{ signed(preview.boughtReturnPercent) }}
            </p>
          </div>
          <div>
            <p class="eyebrow">{{ source?.sold.symbol }} kept</p>
            <p class="mt-1 font-display text-lg font-bold tabular-nums" :class="tone(preview.keptReturnPercent)">
              {{ signed(preview.keptReturnPercent) }}
            </p>
          </div>
          <div>
            <p class="eyebrow">Edge</p>
            <p class="mt-1 font-display text-lg font-bold tabular-nums" :class="tone(preview.edgePoints)">{{ points(preview.edgePoints) }}</p>
            <p v-if="preview.edgeValue !== null" class="text-xs tabular-nums" :class="tone(preview.edgeValue)">
              {{ signedMoney(preview.edgeValue, source?.bought.currency) }}
            </p>
          </div>
        </div>
      </section>

      <TradesField v-if="mode !== 'close'" v-model="form.note" label="Note" placeholder="Why the switch (optional)" />

      <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" class="rounded-full bg-surface-low px-5 py-3 text-sm font-semibold" @click="emit('close')">Cancel</button>
        <button class="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-40" :disabled="saving">
          {{ saving ? 'Saving…' : mode === 'close' ? 'Close exchange' : mode === 'add' ? 'Add exchange' : 'Save' }}
        </button>
      </div>
    </form>
  </TradesDialog>
</template>
