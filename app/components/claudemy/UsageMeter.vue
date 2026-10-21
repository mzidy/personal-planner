<script setup lang="ts">
import { estimateClaudemyCost } from '~~/shared/utils/claudemy-check'

const props = defineProps<{
  inputTokens: number
  outputTokens: number
  webSearches: number
  /** A step is running right now, so the numbers are about to move. */
  running?: boolean
  label?: string
}>()

/**
 * Claude API usage so far, kept in view while a course is being built.
 * Input counts cache writes at 1.25x and cache reads at 0.1x, as they bill,
 * so the estimate follows the invoice rather than the raw token count.
 */
const cost = computed(() => estimateClaudemyCost(props))

function compact(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`
  }
  return String(value)
}
</script>

<template>
  <div
    class="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border sm:rounded-full border-outline/20 bg-surface/95 px-4 py-2 text-xs shadow-ambient backdrop-blur"
    :title="`Claude API usage${label ? ` (${label})` : ''}: ${inputTokens.toLocaleString('en-US')} input tokens (cache weighted as billed), ${outputTokens.toLocaleString('en-US')} output tokens, ${webSearches} web searches. Estimated at Claude Opus 5.5 list prices: $4 / $20 per million tokens and $10 per 1,000 searches.`"
  >
    <span class="flex items-center gap-1.5 font-semibold uppercase tracking-[0.14em] text-muted">
      <span class="relative flex h-2 w-2">
        <span v-if="running" class="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
        <span class="relative inline-flex h-2 w-2 rounded-full" :class="running ? 'bg-teal' : 'bg-outline'" />
      </span>
      {{ label || 'Tokens' }}
    </span>
    <span class="tabular-nums text-ink">
      <span class="font-semibold">{{ compact(inputTokens) }}</span> in · <span class="font-semibold">{{ compact(outputTokens) }}</span> out
    </span>
    <span class="tabular-nums text-muted">{{ webSearches }} {{ webSearches === 1 ? 'search' : 'searches' }}</span>
    <span class="font-display text-sm font-bold tabular-nums text-ink">≈ ${{ cost.toFixed(2) }}</span>
  </div>
</template>
