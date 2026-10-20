<script setup lang="ts">
import type { VolatilitySeries } from '~~/shared/types/markets'

const props = defineProps<{
  series: VolatilitySeries
}>()

/**
 * The VIX on its own absolute scale, beside the index comparison rather than
 * on it. Over the same twelve weeks the equity indices move a couple of
 * percent and this can move thirty, so sharing their percent axis would
 * flatten both of them into a straight line.
 */
const CHART = { width: 320, height: 64, pad: 4 }

const BAND_COPY: Record<VolatilitySeries['band'], { label: string; note: string; tone: string }> = {
  calm: { label: 'Calm', note: 'below 15', tone: 'bg-emerald-100 text-emerald-800' },
  normal: { label: 'Normal', note: '15 to 20', tone: 'bg-surface text-muted' },
  elevated: { label: 'Elevated', note: '20 to 30', tone: 'bg-amber-100 text-amber-900' },
  high: { label: 'High', note: 'above 30', tone: 'bg-rose-100 text-rose-800' }
}

const band = computed(() => BAND_COPY[props.series.band])

const sparkline = computed(() => {
  const points = props.series.points
  if (points.length < 2) {
    return ''
  }

  const values = points.map(point => point.close)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const inner = CHART.height - CHART.pad * 2

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * CHART.width
      const y = CHART.pad + inner - ((point.close - min) / span) * inner
      return `${x},${y}`
    })
    .join(' ')
})

function format(value: number | null) {
  return value === null ? '—' : value.toFixed(2)
}

function signedPercent(value: number | null) {
  if (value === null) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

/** A rising VIX is not good news, so the usual green-for-up would mislead. */
const changeTone = computed(() => {
  const value = props.series.changePercent
  if (!value) {
    return 'text-muted'
  }
  return value > 0 ? 'text-rose-700' : 'text-emerald-700'
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-soft bg-surface-low px-5 py-4">
    <div>
      <div class="flex items-center gap-2">
        <p class="eyebrow">Volatility · VIX</p>
        <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="band.tone">
          {{ band.label }}
        </span>
      </div>
      <p class="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">{{ format(series.latest) }}</p>
      <p class="mt-1 text-xs text-muted">
        <span :class="changeTone">{{ signedPercent(series.changePercent) }}</span>
        over 12 weeks · {{ band.note }}
      </p>
    </div>

    <div class="min-w-[12rem] flex-1">
      <svg
        v-if="sparkline"
        :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
        class="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="VIX over the last 12 weeks"
      >
        <polyline
          :points="sparkline"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-ink"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <div class="mt-1 flex justify-between text-xs text-muted">
        <span>low {{ format(series.low) }}</span>
        <span>high {{ format(series.high) }}</span>
      </div>
    </div>
  </div>
</template>
