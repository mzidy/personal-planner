<script setup lang="ts">
import type { TickerSeries } from '~~/shared/types/ticker-series'

const props = defineProps<{
  series: TickerSeries
}>()

/**
 * Price and its 200-day average on one absolute axis — unlike the index
 * comparison, both lines are the same instrument in the same currency, so
 * indexing them to a common start would hide exactly what is being looked at:
 * how far the price sits from the average.
 */
const CHART = { width: 760, height: 260, left: 52, right: 12, top: 16, bottom: 26 }

const plot = {
  width: CHART.width - CHART.left - CHART.right,
  height: CHART.height - CHART.top - CHART.bottom
}

const points = computed(() => props.series.points)

const scale = computed(() => {
  const values = points.value.flatMap(point =>
    point.ma200 === null ? [point.close] : [point.close, point.ma200]
  )

  if (!values.length) {
    return null
  }

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const spread = rawMax - rawMin || Math.abs(rawMax) * 0.05 || 1
  const padding = spread * 0.08

  return { min: rawMin - padding, max: rawMax + padding }
})

function xFor(index: number) {
  const count = points.value.length || 1
  if (count === 1) {
    return CHART.left + plot.width / 2
  }
  return CHART.left + (index / (count - 1)) * plot.width
}

function yFor(value: number) {
  const bounds = scale.value
  if (!bounds || bounds.max === bounds.min) {
    return CHART.top + plot.height / 2
  }
  const ratio = (value - bounds.min) / (bounds.max - bounds.min)
  return CHART.top + plot.height - ratio * plot.height
}

const pricePath = computed(() => points.value.map((p, i) => `${xFor(i)},${yFor(p.close)}`).join(' '))

/** The average only exists once 200 closes sit behind it, so it may start late. */
const maPath = computed(() =>
  points.value
    .map((point, index) => (point.ma200 === null ? null : `${xFor(index)},${yFor(point.ma200)}`))
    .filter((value): value is string => value !== null)
    .join(' ')
)

const gridLines = computed(() => {
  const bounds = scale.value
  if (!bounds) {
    return []
  }
  return [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const value = bounds.max - ratio * (bounds.max - bounds.min)
    return { y: CHART.top + ratio * plot.height, label: formatPrice(value) }
  })
})

/** A label every ~6 weeks; daily ticks would be unreadable. */
const dateTicks = computed(() => {
  const count = points.value.length
  if (!count) {
    return []
  }
  const step = Math.max(1, Math.floor(count / 6))
  const ticks: { x: number; label: string }[] = []

  for (let index = 0; index < count; index += step) {
    ticks.push({
      x: xFor(index),
      label: new Date(`${points.value[index]!.date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    })
  }
  return ticks
})

function formatPrice(value: number) {
  const magnitude = Math.abs(value)
  const digits = magnitude >= 1000 ? 0 : magnitude >= 10 ? 1 : 2
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// ---- Hover ----------------------------------------------------------------
const hoveredIndex = ref<number | null>(null)

const hoverBands = computed(() =>
  points.value.map((point, index) => {
    const x = xFor(index)
    const left = index === 0 ? 0 : (xFor(index - 1) + x) / 2
    const right = index === points.value.length - 1 ? CHART.width : (x + xFor(index + 1)) / 2
    return { date: point.date, index, x: left, width: right - left }
  })
)

const active = computed(() => {
  const index = hoveredIndex.value
  const point = index === null ? null : points.value[index]
  if (index === null || !point) {
    return null
  }

  const x = xFor(index)
  return {
    point,
    x,
    left: `${(x / CHART.width) * 100}%`,
    top: `calc(${(yFor(point.close) / CHART.height) * 100}% - 0.85rem)`,
    transform: `translate(${
      x < CHART.width * 0.2 ? '-1rem' : x > CHART.width * 0.8 ? 'calc(-100% + 0.75rem)' : '-50%'
    }, -100%)`,
    priceY: yFor(point.close),
    maY: point.ma200 === null ? null : yFor(point.ma200)
  }
})

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <span class="flex items-center gap-2">
        <span class="h-0.5 w-6 rounded-full bg-ink"></span>
        <span class="text-sm font-semibold text-ink">Price</span>
        <span class="text-sm text-muted">{{ formatPrice(series.latestClose || 0) }} {{ series.currency }}</span>
      </span>
      <span class="flex items-center gap-2">
        <svg class="h-2 w-6 text-teal" viewBox="0 0 24 4" aria-hidden="true">
          <line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" stroke-width="3" stroke-dasharray="7 4" stroke-linecap="round" />
        </svg>
        <span class="text-sm font-semibold text-ink">200-day average</span>
        <span class="text-sm text-muted">
          {{ series.latestMa200 === null ? 'not enough history' : formatPrice(series.latestMa200) }}
        </span>
      </span>
    </div>

    <div class="relative" @pointerleave="hoveredIndex = null">
      <svg
        :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
        class="w-full"
        role="img"
        :aria-label="`${series.symbol} price and 200-day average over the last year`"
      >
        <g>
          <line
            v-for="line in gridLines"
            :key="`grid-${line.label}`"
            :x1="CHART.left"
            :x2="CHART.width - CHART.right"
            :y1="line.y"
            :y2="line.y"
            stroke="currentColor"
            stroke-width="1"
            class="text-black/10"
          />
          <text
            v-for="line in gridLines"
            :key="`label-${line.label}`"
            :x="CHART.left - 8"
            :y="line.y + 4"
            text-anchor="end"
            font-size="11"
            fill="currentColor"
            class="text-muted"
          >
            {{ line.label }}
          </text>
        </g>

        <line
          v-if="active"
          :x1="active.x"
          :x2="active.x"
          :y1="CHART.top - 4"
          :y2="CHART.top + plot.height"
          stroke="currentColor"
          stroke-width="1.5"
          class="text-ink/25"
        />

        <polyline
          v-if="maPath"
          :points="maPath"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-dasharray="7 4"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-teal"
        />

        <polyline
          :points="pricePath"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-ink"
        />

        <template v-if="active">
          <circle :cx="active.x" :cy="active.priceY" r="5" fill="currentColor" class="text-ink" />
          <circle
            v-if="active.maY !== null"
            :cx="active.x"
            :cy="active.maY"
            r="5"
            fill="currentColor"
            class="text-teal"
          />
        </template>

        <g>
          <text
            v-for="tick in dateTicks"
            :key="`x-${tick.label}`"
            :x="tick.x"
            :y="CHART.height - 8"
            text-anchor="middle"
            font-size="11"
            fill="currentColor"
            class="text-muted"
          >
            {{ tick.label }}
          </text>
        </g>

        <rect
          v-for="band in hoverBands"
          :key="`band-${band.date}`"
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
          class="pointer-events-none absolute z-10"
          :style="{ left: active.left, top: active.top, transform: active.transform }"
        >
          <div class="min-w-[12rem] rounded-2xl bg-ink px-4 py-3 text-white shadow-ambient">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
              {{ formatDate(active.point.date) }}
            </p>
            <div class="mt-3 space-y-1.5">
              <div class="flex items-center justify-between gap-4">
                <span class="text-sm text-white/80">Price</span>
                <span class="text-sm font-semibold tabular-nums">{{ formatPrice(active.point.close) }}</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-sm text-white/80">200-day</span>
                <span class="text-sm font-semibold tabular-nums">
                  {{ active.point.ma200 === null ? '—' : formatPrice(active.point.ma200) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
