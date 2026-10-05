<script setup lang="ts">
import type { MarketSeries } from '~~/shared/types/markets'

const props = defineProps<{
  series: MarketSeries[]
}>()

/**
 * The two indices sit at very different absolute levels, so the chart plots each
 * one's percent change from the first week in the window. That keeps both on one
 * axis and makes the comparison the point.
 *
 * Note the theme flattens `teal` to a single token, so the numeric Tailwind scale
 * (text-teal-600 and friends) does not exist here — only `text-teal` resolves. The
 * second line is dashed as well so the two stay distinguishable either way.
 */
const TONES = [
  { stroke: 'text-ink', dash: undefined, width: 2.5 },
  { stroke: 'text-teal', dash: '7 4', width: 3 }
] as const

const CHART = { width: 720, height: 200, left: 44, right: 12, top: 16, bottom: 26 }

const plot = {
  width: CHART.width - CHART.left - CHART.right,
  height: CHART.height - CHART.top - CHART.bottom
}

const weeks = computed(() => props.series[0]?.points || [])

const scale = computed(() => {
  const values = props.series.flatMap(item => item.points.map(point => point.changePercent))

  if (!values.length) {
    return null
  }

  // Always keep the 0% baseline in frame — it is the reference the lines are read against.
  const rawMin = Math.min(0, ...values)
  const rawMax = Math.max(0, ...values)
  const spread = rawMax - rawMin
  const padding = spread < 1 ? 0.75 : spread * 0.15

  return { min: rawMin - padding, max: rawMax + padding }
})

function xFor(index: number) {
  const count = weeks.value.length || 1
  if (count === 1) {
    return CHART.left + plot.width / 2
  }
  return CHART.left + (index / (count - 1)) * plot.width
}

function yFor(percent: number) {
  const bounds = scale.value
  if (!bounds || bounds.max === bounds.min) {
    return CHART.top + plot.height / 2
  }
  const ratio = (percent - bounds.min) / (bounds.max - bounds.min)
  return CHART.top + plot.height - ratio * plot.height
}

const lines = computed(() =>
  props.series.map((item, seriesIndex) => ({
    symbol: item.symbol,
    name: item.name,
    ...TONES[seriesIndex % TONES.length]!,
    changePercent: item.changePercent,
    latestClose: item.latestClose,
    polyline: item.points.map((point, index) => `${xFor(index)},${yFor(point.changePercent)}`).join(' '),
    dots: item.points.map((point, index) => ({
      key: `${item.symbol}-${point.weekKey}`,
      index,
      x: xFor(index),
      y: yFor(point.changePercent)
    }))
  }))
)

const gridLines = computed(() => {
  const bounds = scale.value
  if (!bounds) {
    return []
  }
  return [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const percent = bounds.max - ratio * (bounds.max - bounds.min)
    return { y: CHART.top + ratio * plot.height, label: `${percent.toFixed(1)}%` }
  })
})

const baselineY = computed(() => (scale.value ? yFor(0) : null))

// ---- Hover ----------------------------------------------------------------
const hoveredIndex = ref<number | null>(null)

/**
 * Full-height invisible bands, one per week, so the whole column is a hover
 * target rather than a 3.5px dot. Each band reaches halfway to its neighbours.
 */
const hoverBands = computed(() =>
  weeks.value.map((point, index) => {
    const x = xFor(index)
    const left = index === 0 ? 0 : (xFor(index - 1) + x) / 2
    const right = index === weeks.value.length - 1 ? CHART.width : (x + xFor(index + 1)) / 2
    return { weekKey: point.weekKey, index, x: left, width: right - left }
  })
)

const activeWeek = computed(() => {
  const index = hoveredIndex.value
  if (index === null || !weeks.value[index]) {
    return null
  }

  const rows = props.series
    .map((item, seriesIndex) => {
      const point = item.points[index]
      return point ? { ...TONES[seriesIndex % TONES.length]!, name: item.name, point } : null
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (!rows.length) {
    return null
  }

  const x = xFor(index)
  const ys = rows.map(row => yFor(row.point.changePercent))

  // The card normally sits above the highest point of the week, but that would
  // push it out of the chart when the week is near the top — so flip it below
  // the lowest point instead.
  const placeBelow = Math.min(...ys) < CHART.height * 0.45
  const anchorY = placeBelow ? Math.max(...ys) : Math.min(...ys)

  // Near the edges the card is anchored to its own edge rather than its centre,
  // so it never spills sideways out of the panel.
  const xOffset =
    x < CHART.width * 0.18
      ? '-1rem'
      : x > CHART.width * 0.82
        ? 'calc(-100% + 0.75rem)'
        : '-50%'

  return {
    index,
    label: weeks.value[index]!.label,
    rows,
    x,
    // Percentages so the overlay tracks the SVG as it scales to the container.
    left: `${(x / CHART.width) * 100}%`,
    top: `calc(${(anchorY / CHART.height) * 100}% ${placeBelow ? '+' : '-'} 0.85rem)`,
    transform: `translate(${xOffset}, ${placeBelow ? '0' : '-100%'})`
  }
})

function formatPercent(value: number | null) {
  if (value === null) {
    return '—'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function percentTone(value: number | null) {
  if (!value) {
    return 'text-muted'
  }
  return value > 0 ? 'text-emerald-700' : 'text-rose-700'
}

function tooltipPercentTone(value: number) {
  if (!value) {
    return 'text-white/60'
  }
  return value > 0 ? 'text-emerald-300' : 'text-rose-300'
}

function formatClose(value: number | null) {
  return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div v-for="line in lines" :key="line.symbol" class="flex items-baseline gap-2">
        <svg class="h-2 w-6 shrink-0 overflow-visible" :class="line.stroke" viewBox="0 0 24 4" aria-hidden="true">
          <line
            x1="0"
            y1="2"
            x2="24"
            y2="2"
            stroke="currentColor"
            :stroke-width="line.width"
            :stroke-dasharray="line.dash"
            stroke-linecap="round"
          />
        </svg>
        <span class="text-sm font-semibold text-ink">{{ line.name }}</span>
        <span class="text-sm text-muted">{{ formatClose(line.latestClose) }}</span>
        <span class="text-sm font-semibold" :class="percentTone(line.changePercent)">
          {{ formatPercent(line.changePercent) }}
        </span>
      </div>
    </div>

    <div v-if="lines.length" class="relative" @pointerleave="hoveredIndex = null">
      <svg
        :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
        class="w-full"
        role="img"
        aria-label="S&P 500 and Nasdaq percent change over the last 12 weeks"
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
          v-if="baselineY !== null"
          :x1="CHART.left"
          :x2="CHART.width - CHART.right"
          :y1="baselineY"
          :y2="baselineY"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-dasharray="5 4"
          class="text-black/25"
        />

        <!-- Crosshair for the hovered week, drawn under the lines. -->
        <line
          v-if="activeWeek"
          :x1="activeWeek.x"
          :x2="activeWeek.x"
          :y1="CHART.top - 4"
          :y2="CHART.top + plot.height"
          stroke="currentColor"
          stroke-width="1.5"
          class="text-ink/25"
        />

        <polyline
          v-for="line in lines"
          :key="`line-${line.symbol}`"
          :points="line.polyline"
          fill="none"
          stroke="currentColor"
          :stroke-width="line.width"
          :stroke-dasharray="line.dash"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="line.stroke"
        />

        <g v-for="line in lines" :key="`dots-${line.symbol}`">
          <circle
            v-for="dot in line.dots"
            :key="dot.key"
            :cx="dot.x"
            :cy="dot.y"
            :r="hoveredIndex === dot.index ? 6 : 3.5"
            fill="currentColor"
            stroke-width="2"
            class="transition-all duration-100"
            :class="[line.stroke, hoveredIndex === dot.index ? 'stroke-surface' : 'stroke-none']"
          />
        </g>

        <g>
          <text
            v-for="(point, index) in weeks"
            :key="`x-${point.weekKey}`"
            :x="xFor(index)"
            :y="CHART.height - 8"
            text-anchor="middle"
            font-size="11"
            fill="currentColor"
            :class="hoveredIndex === index ? 'font-semibold text-ink' : 'text-muted'"
          >
            {{ hoveredIndex === index || index % 2 === 0 ? point.label : '' }}
          </text>
        </g>

        <!-- Hover targets last so they sit above every mark. -->
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

      <!-- Tooltip lives in HTML so it gets real type, padding and a shadow. -->
      <!-- Opacity only: the card's position is an inline transform, which a class cannot animate. -->
      <Transition
        enter-active-class="transition-opacity duration-100 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-75 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="activeWeek"
          class="pointer-events-none absolute z-10"
          :style="{ left: activeWeek.left, top: activeWeek.top, transform: activeWeek.transform }"
        >
          <div class="min-w-[13rem] rounded-2xl bg-ink px-4 py-3 text-white shadow-ambient">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
              Week of {{ activeWeek.label }}
            </p>
            <div class="mt-3 space-y-2">
              <div v-for="row in activeWeek.rows" :key="row.name" class="flex items-center gap-3">
                <svg class="h-2 w-5 shrink-0" :class="row.stroke" viewBox="0 0 20 4" aria-hidden="true">
                  <line
                    x1="0"
                    y1="2"
                    x2="20"
                    y2="2"
                    stroke="currentColor"
                    :stroke-width="row.width"
                    :stroke-dasharray="row.dash"
                    stroke-linecap="round"
                  />
                </svg>
                <span class="flex-1 whitespace-nowrap text-sm font-medium text-white/80">{{ row.name }}</span>
                <span class="whitespace-nowrap text-sm font-semibold tabular-nums">
                  {{ formatClose(row.point.close) }}
                </span>
                <span
                  class="w-16 whitespace-nowrap text-right text-sm font-semibold tabular-nums"
                  :class="tooltipPercentTone(row.point.changePercent)"
                >
                  {{ formatPercent(row.point.changePercent) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
