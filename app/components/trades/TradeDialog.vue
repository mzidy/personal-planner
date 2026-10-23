<script setup lang="ts">
import type { OpenTradeRecord, TradeView, TradesView } from '~~/shared/types/trades'
import { tradeResult } from '~~/shared/utils/trades'
import type { TradeDialogMode } from '~/composables/useTradeFormat'

const props = defineProps<{ mode: TradeDialogMode; trade: TradeView | null }>()
const emit = defineEmits<{ close: []; saved: [view: TradesView] }>()

const { money, signedMoney, signed, tone, day, parseAmount, localToday } = useTradeFormat()
const { watchClose } = useCloseLookup()

const source = props.trade
const today = localToday()
const amount = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value))

const form = reactive({
  symbol: source?.symbol ?? '',
  quantity: amount(source?.quantity),
  entryPrice: amount(source?.entryPrice),
  entryDate: source?.entryDate ?? today,
  targetPrice: amount(source?.targetPrice),
  stopPrice: amount(source?.stopPrice),
  note: source?.note ?? '',
  exitPrice: amount(source?.exitPrice),
  exitDate: source?.exitDate ?? today
})

const closing = computed(() => props.mode === 'close' || (props.mode === 'edit' && source?.exitDate != null))
const title = computed(() => {
  if (props.mode === 'add') {
    return 'New trade'
  }
  return `${props.mode === 'close' ? 'Close' : 'Edit'} ${source?.symbol}`
})

// As in the exchange form: the day's close is a hint, filled in while the price is untouched.
const closes = reactive<Record<string, string>>({})
const suggested = new Map<string, string>()

function prefill<K extends string>(key: string, symbol: () => string, date: () => string, target: Record<K, string>, field: K) {
  watchClose(symbol, date, close => {
    closes[key] = `${close.symbol} closed at ${money(close.close, close.currency)} on ${day(close.date)}`
    const value = String(close.close)
    if (!target[field].trim() || target[field] === suggested.get(key)) {
      target[field] = value
      suggested.set(key, value)
    }
  })
}

if (props.mode !== 'close') {
  prefill('entry', () => form.symbol, () => form.entryDate, form, 'entryPrice')
}
prefill('exit', () => (closing.value ? form.symbol : ''), () => form.exitDate, form, 'exitPrice')

const payload = computed(() => ({
  symbol: form.symbol.trim().toUpperCase(),
  quantity: parseAmount(form.quantity),
  entryPrice: parseAmount(form.entryPrice),
  entryDate: form.entryDate,
  targetPrice: parseAmount(form.targetPrice),
  stopPrice: parseAmount(form.stopPrice),
  note: form.note.trim(),
  exitPrice: closing.value ? parseAmount(form.exitPrice) : null,
  exitDate: closing.value ? form.exitDate || null : null
}))

/** The risk to the stop and the reward to the target, per share and as a ratio. */
const plan = computed(() => {
  const { entryPrice: entry, stopPrice: stop, targetPrice: target } = payload.value
  if (!entry || !stop || !target || stop >= entry || target <= entry) {
    return null
  }
  return { risk: entry - stop, reward: target - entry, ratio: (target - entry) / (entry - stop) }
})

const preview = computed(() => {
  const body = payload.value
  if (!closing.value || !source || body.exitPrice === null || !body.exitDate || !body.entryPrice || !body.quantity) {
    return null
  }
  const record: OpenTradeRecord = { ...source, ...body, entryPrice: body.entryPrice, quantity: body.quantity, exitPrice: body.exitPrice }
  return tradeResult(record, body.exitPrice, body.exitDate)
})

const saving = ref(false)
const errorMessage = ref('')

async function save() {
  const body = payload.value
  if (!body.symbol || body.quantity === null || body.entryPrice === null || !body.entryDate) {
    errorMessage.value = 'Fill in the ticker, lot, entry price and date.'
    return
  }
  if ((form.targetPrice.trim() && body.targetPrice === null) || (form.stopPrice.trim() && body.stopPrice === null)) {
    errorMessage.value = 'The target and stop have to be prices, or empty.'
    return
  }
  if (closing.value && (body.exitPrice === null || !body.exitDate)) {
    errorMessage.value = 'Closing needs the exit price and the date.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const view = source
      ? await $fetch<TradesView>(`/api/trades/positions/${source.id}`, { method: 'PUT', body })
      : await $fetch<TradesView>('/api/trades/positions', { method: 'POST', body })
    emit('saved', view)
  } catch (error) {
    const fetchError = error as { data?: { statusMessage?: string; message?: string } }
    errorMessage.value = fetchError?.data?.statusMessage || fetchError?.data?.message || 'The trade could not be saved.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <TradesDialog eyebrow="Open trades" :title="title" @close="emit('close')">
    <form class="space-y-5" @submit.prevent="save">
      <template v-if="mode !== 'close'">
        <div class="grid gap-3 sm:grid-cols-4">
          <TradesField v-model="form.symbol" label="Ticker" kind="ticker" placeholder="AAPL" />
          <TradesField v-model="form.quantity" label="Lot" kind="amount" placeholder="10" />
          <TradesField v-model="form.entryPrice" label="Entry price" kind="amount" placeholder="182.40" />
          <TradesField v-model="form.entryDate" label="Entry date" kind="date" />
        </div>
        <p v-if="closes.entry" class="-mt-2 text-xs text-muted">{{ closes.entry }}</p>

        <div class="grid gap-3 sm:grid-cols-2">
          <TradesField v-model="form.targetPrice" label="Target (optional)" kind="amount" placeholder="Where you take profit" />
          <TradesField v-model="form.stopPrice" label="Stop (optional)" kind="amount" placeholder="Where you get out" />
        </div>
        <p v-if="plan" class="-mt-2 text-xs text-muted">
          Risking {{ money(plan.risk, source?.currency) }} a share to make {{ money(plan.reward, source?.currency) }}:
          <span class="font-semibold text-ink">{{ plan.ratio.toFixed(1) }} : 1</span> reward to risk.
        </p>
      </template>

      <section v-if="closing" class="space-y-3" :class="{ 'border-t border-outline/10 pt-5': mode !== 'close' }">
        <p v-if="mode === 'close'" class="text-sm leading-6 text-muted">
          Closing moves {{ source?.symbol }} into the history, with the result at its exit price.
        </p>
        <p v-else class="text-sm font-semibold">Closed</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <TradesField v-model="form.exitDate" label="Exit date" kind="date" />
          <TradesField v-model="form.exitPrice" label="Exit price" kind="amount" />
        </div>
        <p v-if="closes.exit" class="text-xs text-muted">{{ closes.exit }}</p>

        <div v-if="preview" class="grid grid-cols-3 gap-2 rounded-soft bg-surface-low p-4 text-center">
          <div>
            <p class="eyebrow">Result</p>
            <p class="mt-1 font-display text-lg font-bold tabular-nums" :class="tone(preview.pnl)">
              {{ signedMoney(preview.pnl, source?.currency) }}
            </p>
          </div>
          <div>
            <p class="eyebrow">Return</p>
            <p class="mt-1 font-display text-lg font-bold tabular-nums" :class="tone(preview.pnlPercent)">{{ signed(preview.pnlPercent) }}</p>
          </div>
          <div>
            <p class="eyebrow">{{ preview.rMultiple !== null ? 'R' : 'Held' }}</p>
            <p class="mt-1 font-display text-lg font-bold tabular-nums">
              {{ preview.rMultiple !== null ? signed(preview.rMultiple, 'R', 1) : `${preview.days} d` }}
            </p>
          </div>
        </div>
      </section>

      <TradesField v-if="mode !== 'close'" v-model="form.note" label="Note" placeholder="The idea behind the trade (optional)" />

      <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" class="rounded-full bg-surface-low px-5 py-3 text-sm font-semibold" @click="emit('close')">Cancel</button>
        <button class="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-40" :disabled="saving">
          {{ saving ? 'Saving…' : mode === 'close' ? 'Close trade' : mode === 'add' ? 'Add trade' : 'Save' }}
        </button>
      </div>
    </form>
  </TradesDialog>
</template>
