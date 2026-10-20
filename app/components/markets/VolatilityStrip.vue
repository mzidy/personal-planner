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

/** Each week placed in the viewBox, so the line, the dots and the hover all agree. */
const plotted = computed(() => {
  const points = props.series.points
  if (points.length < 2) {
    return []
  }

  const values = points.map(point => point.close)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const inner = CHART.height - CHART.pad * 2

  return points.map((point, index) => ({
    ...point,
    index,
    x: (index / (points.length - 1)) * CHART.width,
    y: CHART.pad + inner - ((point.close - min) / span) * inner
  }))
})

const sparkline = computed(() => plotted.value.map(point => `${point.x},${point.y}`).join(' '))

const hoveredIndex = ref<number | null>(null)

/** Full-height bands reaching halfway to each neighbour — the line is 2px tall. */
const hoverBands = computed(() =>
  plotted.value.map((point, index) => {
    const left = index === 0 ? 0 : (plotted.value[index - 1]!.x + point.x) / 2
    const right =
      index === plotted.value.length - 1 ? CHART.width : (point.x + plotted.value[index + 1]!.x) / 2
    return { weekKey: point.weekKey, index, x: left, width: right - left }
  })
)

const active = computed(() => {
  const index = hoveredIndex.value
  const point = index === null ? null : plotted.value[index]
  if (!point) {
    return null
  }

  return {
    point,
    left: `${(point.x / CHART.width) * 100}%`,
    top: `calc(${(point.y / CHART.height) * 100}% - 0.6rem)`,
    // Anchored to its own edge near the ends so it cannot spill out of the card.
    transform: `translate(${
      point.x < CHART.width * 0.2
        ? '-0.5rem'
        : point.x > CHART.width * 0.8
          ? 'calc(-100% + 0.5rem)'
          : '-50%'
    }, -100%)`
  }
})

function formatDate(weekKey: string) {
  return new Date(`${weekKey}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

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
      <div class="relative" @pointerleave="hoveredIndex = null">
        <svg
          v-if="sparkline"
          :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
          class="w-full overflow-visible"
          role="img"
          aria-label="VIX over the last 12 weeks"
        >
          <line
            v-if="active"
            :x1="active.point.x"
            :x2="active.point.x"
            y1="0"
            :y2="CHART.height"
            stroke="currentColor"
            stroke-width="1"
            class="text-ink/25"
          />

          <polyline
            :points="sparkline"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-ink"
          />

          <circle
            v-if="active"
            :cx="active.point.x"
            :cy="active.point.y"
            r="4"
            fill="currentColor"
            stroke-width="2"
            class="text-ink stroke-surface-low"
          />

          <rect
            v-for="band in hoverBands"
            :key="`band-${band.weekKey}`"
            :x="band.x"
            :width="band.width"
            y="0"
            :height="CHART.height"
            fill="transparent"
            tabindex="0"
            class="cursor-crosshair outline-none"
            @pointerenter="hoveredIndex = band.index"
            @focus="hoveredIndex = band.index"
            @blur="hoveredIndex = null"
          />
        </svg>

        <Transition
          enter-active-class="transition-opacity duration-100 ease-out"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-75 ease-in"
          leave-to-class="opacity-0"
        >
          <div
            v-if="active"
            class="pointer-events-none absolute z-10 whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-white shadow-ambient"
            :style="{ left: active.left, top: active.top, transform: active.transform }"
          >
            <span class="text-xs text-white/60">{{ formatDate(active.point.weekKey) }}</span>
            <span class="ml-2 text-sm font-semibold tabular-nums">{{ format(active.point.close) }}</span>
          </div>
        </Transition>
      </div>

      <div class="mt-1 flex justify-between text-xs text-muted">
        <span>low {{ format(series.low) }}</span>
        <span>high {{ format(series.high) }}</span>
      </div>
    </div>
  </div>
</template>
