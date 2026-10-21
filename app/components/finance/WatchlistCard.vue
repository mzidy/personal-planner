<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { WatchlistItem, WatchlistView } from '~~/shared/types/watchlist'
import { moveInList } from '~~/shared/utils/watchlist'

const emit = defineEmits<{ select: [symbol: string] }>()

/** Prices refresh this often, and only while at least one listed market is in its regular session. */
const REFRESH_MS = 5 * 60 * 1000
const TOP = 3

const view = ref<WatchlistView | null>(null)
const loading = ref(false)
const adding = ref(false)
const symbol = ref('')
const errorMessage = ref('')
const dialogOpen = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const items = computed(() => view.value?.items || [])
const top = computed(() => items.value.slice(0, TOP))

function messageOf(error: unknown, fallback: string) {
  const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
  return fetchError?.data?.statusMessage || fetchError?.data?.message || fetchError?.message || fallback
}

async function load() {
  if (loading.value) {
    return
  }
  loading.value = true
  try {
    view.value = await $fetch<WatchlistView>('/api/watchlist')
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = messageOf(error, 'The watchlist could not be loaded.')
  } finally {
    loading.value = false
  }
}

async function add() {
  const value = symbol.value.trim().toUpperCase()
  if (!value || adding.value) {
    return
  }
  adding.value = true
  errorMessage.value = ''
  try {
    view.value = await $fetch<WatchlistView>('/api/watchlist', { method: 'POST', body: { symbol: value } })
    symbol.value = ''
  } catch (error) {
    errorMessage.value = messageOf(error, `${value} could not be added.`)
  } finally {
    adding.value = false
  }
}

async function remove(item: WatchlistItem) {
  errorMessage.value = ''
  try {
    view.value = await $fetch<WatchlistView>(`/api/watchlist/${item.id}`, { method: 'DELETE' })
  } catch (error) {
    errorMessage.value = messageOf(error, `${item.symbol} could not be removed.`)
  }
}

/** Moves at once on screen, then saves; a failed save reloads the real order. */
async function move(item: WatchlistItem, direction: -1 | 1) {
  if (!view.value) {
    return
  }
  const ids = moveInList(
    view.value.items.map(entry => entry.id),
    item.id,
    direction
  )
  const byId = new Map(view.value.items.map(entry => [entry.id, entry]))
  view.value = { ...view.value, items: ids.map(id => byId.get(id)!) }
  try {
    await $fetch('/api/watchlist/order', { method: 'PUT', body: { ids } })
  } catch (error) {
    errorMessage.value = messageOf(error, 'The new order could not be saved.')
    await load()
  }
}

function select(item: WatchlistItem) {
  dialogOpen.value = false
  emit('select', item.symbol)
}

const updated = computed(() =>
  view.value ? new Date(view.value.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
)

function onVisibility() {
  // Coming back to the tab after a while during market hours: catch up at once.
  if (document.visibilityState === 'visible' && view.value?.marketOpen && Date.now() - new Date(view.value.fetchedAt).getTime() > REFRESH_MS) {
    load()
  }
}

function onDialogKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    dialogOpen.value = false
  }
}

watch(dialogOpen, open => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    window.addEventListener('keydown', onDialogKey)
  } else {
    window.removeEventListener('keydown', onDialogKey)
  }
})

onMounted(() => {
  load()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && view.value?.marketOpen) {
      load()
    }
  }, REFRESH_MS)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('keydown', onDialogKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <PanelCard class="flex flex-col gap-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="eyebrow">Watchlist</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
          {{ items.length }} {{ items.length === 1 ? 'ticker' : 'tickers' }}
        </h2>
        <p class="mt-1 text-xs text-muted">
          <template v-if="view?.marketOpen">
            <span class="font-semibold text-emerald-700">Live</span> · refreshes every 5 min while the market is open · {{ updated }}
          </template>
          <template v-else-if="view">Markets closed · last prices as of {{ updated }}</template>
          <template v-else>Loading…</template>
        </p>
      </div>
      <button
        v-if="items.length > TOP"
        class="shrink-0 rounded-full bg-surface-low px-4 py-2 text-xs font-semibold text-ink transition hover:bg-surface-high"
        @click="dialogOpen = true"
      >
        Show all {{ items.length }}
      </button>
    </div>

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</p>

    <p v-if="view && !items.length" class="rounded-soft bg-surface-low px-4 py-6 text-center text-sm text-muted">
      Add a ticker below to follow its price, daily move and 200-day average.
    </p>

    <ul v-if="top.length" class="space-y-2">
      <FinanceWatchlistRow
        v-for="(item, index) in top"
        :key="item.id"
        :item="item"
        :first="index === 0"
        :last="index === items.length - 1"
        @select="select(item)"
        @move="direction => move(item, direction)"
        @remove="remove(item)"
      />
    </ul>

    <form class="mt-auto flex gap-2" @submit.prevent="add">
      <input
        v-model="symbol"
        class="w-full min-w-0 rounded-2xl bg-surface-low px-4 py-3 text-sm uppercase outline-none"
        type="text"
        maxlength="15"
        placeholder="Add a ticker, e.g. MSFT"
        autocapitalize="characters"
        spellcheck="false"
      />
      <button
        class="shrink-0 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        :disabled="adding || !symbol.trim()"
      >
        {{ adding ? 'Adding…' : 'Add' }}
      </button>
    </form>

    <Teleport to="body">
      <div
        v-if="dialogOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Watchlist"
        @click.self="dialogOpen = false"
      >
        <div class="max-h-full w-full max-w-2xl space-y-4 overflow-auto rounded-panel bg-surface p-5 text-ink shadow-ambient sm:p-6">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="eyebrow">Watchlist</p>
              <h3 class="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">All {{ items.length }} tickers</h3>
            </div>
            <button class="rounded-full bg-surface-low p-2 text-muted transition hover:text-ink" title="Close" @click="dialogOpen = false">
              <X class="h-4 w-4" />
            </button>
          </div>
          <ul class="space-y-2">
            <FinanceWatchlistRow
              v-for="(item, index) in items"
              :key="item.id"
              :item="item"
              :first="index === 0"
              :last="index === items.length - 1"
                                @select="select(item)"
              @move="direction => move(item, direction)"
              @remove="remove(item)"
            />
          </ul>
        </div>
      </div>
    </Teleport>
  </PanelCard>
</template>
