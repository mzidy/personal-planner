<script setup lang="ts">
import type { TickerReviewRecord, TickerReviewsPayload } from '~~/shared/types/ticker'

definePageMeta({
  middleware: 'protected'
})

const { data: payload, refresh } = await usePlannerFetch<TickerReviewsPayload>(
  'ticker-reviews',
  '/api/ticker/reviews'
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

const symbolInput = ref('')
const running = ref(false)
const errorMessage = ref('')
const expandedId = ref<string | null>(null)

const history = computed(() => payload.value?.history || [])

async function runAnalysis() {
  const symbol = symbolInput.value.trim()
  if (!symbol || running.value) {
    return
  }

  running.value = true
  errorMessage.value = ''

  try {
    const record = await $fetch<TickerReviewRecord>('/api/ticker/reviews', {
      method: 'POST',
      body: { symbol }
    })
    symbolInput.value = ''
    await refresh()
    expandedId.value = record.id
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'data' in error
        ? (error as { data?: { statusMessage?: string; message?: string } }).data?.statusMessage ||
          (error as { data?: { message?: string } }).data?.message
        : null
    errorMessage.value = message || 'That analysis could not be run. Check the ticker and try again.'
  } finally {
    running.value = false
  }
}

async function deleteReview(review: TickerReviewRecord) {
  errorMessage.value = ''

  try {
    await $fetch(`/api/ticker/reviews/${review.id}`, { method: 'DELETE' })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to delete that review.'
  }
}

function toggle(review: TickerReviewRecord) {
  expandedId.value = expandedId.value === review.id ? null : review.id
}

function money(value: number | null, currency = 'USD') {
  if (value === null) {
    return '—'
  }
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B ${currency}`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M ${currency}`
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}

function num(value: number | null, suffix = '') {
  return value === null ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`
}

function signedPercent(value: number | null) {
  if (value === null) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function tone(value: number | null) {
  if (value === null || value === 0) {
    return 'text-muted'
  }
  return value > 0 ? 'text-emerald-700' : 'text-rose-700'
}

function shortDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * The review comes back as small, predictable markdown (## headings, - bullets,
 * **bold**), so it is rendered directly rather than pulling in a parser.
 */
interface ReviewBlock {
  heading: string
  paragraphs: string[]
  bullets: string[]
}

function parseReview(markdown: string): ReviewBlock[] {
  const blocks: ReviewBlock[] = []
  let current: ReviewBlock | null = null

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()

    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), paragraphs: [], bullets: [] }
      blocks.push(current)
      continue
    }

    if (!line) {
      continue
    }

    if (!current) {
      current = { heading: '', paragraphs: [], bullets: [] }
      blocks.push(current)
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      current.bullets.push(line.slice(2).trim())
    } else {
      current.paragraphs.push(line)
    }
  }

  return blocks
}

/** Turns **bold** into markup; everything else is escaped by the v-html caller. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(value: string) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>')
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Research"
      title="Ticker analysis"
      subtitle="Enter a symbol for a straight read on the technicals and the fundamentals. Every run is kept."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Saved reviews</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ history.length }}</p>
          <p class="mt-2 text-sm text-muted">Newest first</p>
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

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">New analysis</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Run a ticker</h2>
        <p class="mt-1 text-sm text-muted">
          Prices from Yahoo Finance, fundamentals straight from the company's SEC filings.
        </p>
      </div>

      <form class="flex flex-wrap gap-3" @submit.prevent="runAnalysis">
        <input
          v-model="symbolInput"
          class="min-w-[12rem] flex-1 rounded-2xl bg-surface-low px-4 py-3 uppercase outline-none"
          type="text"
          maxlength="12"
          placeholder="AAPL"
          autocapitalize="characters"
          spellcheck="false"
          :disabled="running"
        />
        <button
          class="rounded-full bg-ink px-6 py-3 font-semibold text-white disabled:opacity-50"
          :disabled="running || !symbolInput.trim()"
        >
          {{ running ? 'Analysing…' : 'Analyse' }}
        </button>
      </form>

      <p v-if="running" class="text-sm text-muted">
        Pulling two years of prices and the latest annual filing, then writing the review. This takes a few
        seconds.
      </p>
      <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ errorMessage }}
      </p>

      <p class="rounded-soft bg-surface-low px-4 py-3 text-xs leading-5 text-muted">
        Educational research, not investment advice. The written review is generated by a language model and
        can be wrong; the numbers above it are computed directly from the sources named.
      </p>
    </PanelCard>

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">History</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
          {{ history.length }} saved {{ history.length === 1 ? 'review' : 'reviews' }}
        </h2>
      </div>

      <p v-if="!history.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm text-muted">
        Nothing analysed yet — run your first ticker above.
      </p>

      <div v-else class="space-y-3">
        <article v-for="review in history" :key="review.id" class="rounded-soft bg-surface-low">
          <div class="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <button type="button" class="min-w-0 flex-1 text-left" @click="toggle(review)">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-display text-lg font-bold tracking-[-0.03em] text-ink">{{ review.symbol }}</p>
                <StatusPill
                  :label="signedPercent(review.technical.return12m)"
                  :tone="(review.technical.return12m || 0) >= 0 ? 'teal' : 'mist'"
                />
                <span class="text-sm text-muted">{{ review.companyName }}</span>
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ num(review.technical.price) }} {{ review.technical.currency }} ·
                {{ shortDateTime(review.createdAt) }}
              </p>
            </button>
            <div class="flex shrink-0 items-center gap-3">
              <button type="button" class="text-xs font-semibold text-ink" @click="toggle(review)">
                {{ expandedId === review.id ? 'Hide' : 'Open' }}
              </button>
              <button type="button" class="text-xs font-semibold text-rose-700" @click="deleteReview(review)">
                Delete
              </button>
            </div>
          </div>

          <div v-if="expandedId === review.id" class="space-y-6 border-t border-outline/10 px-5 py-5">
            <!-- Technical -->
            <section>
              <p class="eyebrow">Technical</p>
              <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div class="rounded-2xl bg-surface px-4 py-3">
                  <p class="eyebrow">Price</p>
                  <p class="mt-1 font-semibold text-ink">{{ num(review.technical.price) }}</p>
                </div>
                <div class="rounded-2xl bg-surface px-4 py-3">
                  <p class="eyebrow">RSI (14)</p>
                  <p class="mt-1 font-semibold text-ink">{{ num(review.technical.rsi14) }}</p>
                </div>
                <div class="rounded-2xl bg-surface px-4 py-3">
                  <p class="eyebrow">52-week range</p>
                  <p class="mt-1 font-semibold text-ink">
                    {{ num(review.technical.low52w) }} – {{ num(review.technical.high52w) }}
                  </p>
                </div>
                <div class="rounded-2xl bg-surface px-4 py-3">
                  <p class="eyebrow">Volatility</p>
                  <p class="mt-1 font-semibold text-ink">{{ num(review.technical.volatility, '%') }}</p>
                </div>
              </div>

              <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div v-for="span in (['1m', '3m', '6m', '12m'] as const)" :key="span" class="rounded-2xl bg-surface px-4 py-3">
                  <p class="eyebrow">{{ span }} return</p>
                  <p
                    class="mt-1 font-semibold"
                    :class="tone(review.technical[`return${span}` as 'return1m'])"
                  >
                    {{ signedPercent(review.technical[`return${span}` as 'return1m']) }}
                  </p>
                </div>
              </div>

              <ul class="mt-3 space-y-1.5">
                <li
                  v-for="signal in review.technical.signals"
                  :key="signal"
                  class="flex gap-2 text-sm leading-6 text-muted"
                >
                  <span class="text-ink">·</span>{{ signal }}
                </li>
              </ul>
            </section>

            <!-- Fundamental -->
            <section>
              <p class="eyebrow">Fundamental</p>
              <p v-if="!review.fundamental.available" class="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm leading-6 text-muted">
                {{ review.fundamental.note }}
              </p>
              <template v-else>
                <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div class="rounded-2xl bg-surface px-4 py-3">
                    <p class="eyebrow">Revenue</p>
                    <p class="mt-1 font-semibold text-ink">{{ money(review.fundamental.revenue) }}</p>
                    <p class="mt-1 text-xs" :class="tone(review.fundamental.revenueGrowthPercent)">
                      {{ signedPercent(review.fundamental.revenueGrowthPercent) }} YoY
                    </p>
                  </div>
                  <div class="rounded-2xl bg-surface px-4 py-3">
                    <p class="eyebrow">Net income</p>
                    <p class="mt-1 font-semibold text-ink">{{ money(review.fundamental.netIncome) }}</p>
                    <p class="mt-1 text-xs text-muted">
                      {{ num(review.fundamental.netMarginPercent, '%') }} margin
                    </p>
                  </div>
                  <div class="rounded-2xl bg-surface px-4 py-3">
                    <p class="eyebrow">Return on equity</p>
                    <p class="mt-1 font-semibold text-ink">
                      {{ num(review.fundamental.returnOnEquityPercent, '%') }}
                    </p>
                  </div>
                  <div class="rounded-2xl bg-surface px-4 py-3">
                    <p class="eyebrow">P/E</p>
                    <p class="mt-1 font-semibold text-ink">{{ num(review.fundamental.peRatio) }}</p>
                    <p class="mt-1 text-xs text-muted">{{ money(review.fundamental.marketCap) }} cap</p>
                  </div>
                </div>

                <ul class="mt-3 space-y-1.5">
                  <li
                    v-for="signal in review.fundamental.signals"
                    :key="signal"
                    class="flex gap-2 text-sm leading-6 text-muted"
                  >
                    <span class="text-ink">·</span>{{ signal }}
                  </li>
                </ul>
                <p class="mt-3 text-xs leading-5 text-muted">{{ review.fundamental.note }}</p>
              </template>
            </section>

            <!-- Written review -->
            <section>
              <p class="eyebrow">The review</p>
              <p
                v-if="!review.review"
                class="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
              >
                No written review for this run.
                <span v-if="review.reviewError">{{ review.reviewError }}</span>
              </p>
              <div v-else class="mt-3 space-y-4">
                <div v-for="(block, index) in parseReview(review.review)" :key="index">
                  <h3
                    v-if="block.heading"
                    class="font-display text-base font-bold tracking-[-0.02em] text-ink"
                  >
                    {{ block.heading }}
                  </h3>
                  <p
                    v-for="(paragraph, pIndex) in block.paragraphs"
                    :key="`p-${pIndex}`"
                    class="mt-2 text-sm leading-7 text-muted"
                    v-html="inlineMarkdown(paragraph)"
                  />
                  <ul v-if="block.bullets.length" class="mt-2 space-y-1.5">
                    <li
                      v-for="(bullet, bIndex) in block.bullets"
                      :key="`b-${bIndex}`"
                      class="flex gap-2 text-sm leading-7 text-muted"
                    >
                      <span class="text-ink">·</span>
                      <span v-html="inlineMarkdown(bullet)" />
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </article>
      </div>
    </PanelCard>
  </div>
</template>
