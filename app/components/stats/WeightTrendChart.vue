<script setup lang="ts">
import type { WeeklyPoint } from '~~/shared/types/stats'

const props = withDefaults(
  defineProps<{
    series: WeeklyPoint[]
    targetWeightKg?: number | null
    /** Compact drops the y-axis labels and shrinks the type, for the dashboard card. */
    compact?: boolean
  }>(),
  { targetWeightKg: null, compact: false }
)

const CHART = computed(() =>
  props.compact
    ? { width: 720, height: 180, left: 40, right: 12, top: 14, bottom: 26 }
    : { width: 720, height: 260, left: 46, right: 16, top: 18, bottom: 30 }
)

const plot = computed(() => ({
  width: CHART.value.width - CHART.value.left - CHART.value.right,
  height: CHART.value.height - CHART.value.top - CHART.value.bottom
}))

const scale = computed(() => {
  const values = props.series.map(point => point.weightKg).filter((v): v is number => v !== null)

  if (!values.length) {
    return null
  }

  const candidates = props.targetWeightKg != null ? [...values, props.targetWeightKg] : values
  const rawMin = Math.min(...candidates)
  const rawMax = Math.max(...candidates)
  const spread = rawMax - rawMin
  const padding = spread < 2 ? 1.5 : spread * 0.15

  return { min: rawMin - padding, max: rawMax + padding }
})

function xFor(index: number) {
  const count = props.series.length || 1
  if (count === 1) {
    return CHART.value.left + plot.value.width / 2
  }
  return CHART.value.left + (index / (count - 1)) * plot.value.width
}

function yFor(weight: number) {
  const bounds = scale.value
  if (!bounds || bounds.max === bounds.min) {
    return CHART.value.top + plot.value.height / 2
  }
  const ratio = (weight - bounds.min) / (bounds.max - bounds.min)
  return CHART.value.top + plot.value.height - ratio * plot.value.height
}

interface ChartPoint {
  weekKey: string
  label: string
  weightKg: number
  index: number
  x: number
  y: number
}

const points = computed<ChartPoint[]>(() => {
  const result: ChartPoint[] = []

  props.series.forEach((point, index) => {
    if (point.weightKg === null) {
      return
    }
    result.push({
      weekKey: point.weekKey,
      label: point.label,
      weightKg: point.weightKg,
      index,
      x: xFor(index),
      y: yFor(point.weightKg)
    })
  })

  return result
})

/** Separate polyline segments so missed weeks leave a visible gap. */
const segments = computed(() => {
  const result: string[] = []
  let current: string[] = []
  let lastIndex: number | null = null

  for (const point of points.value) {
    if (lastIndex !== null && point.index !== lastIndex + 1) {
      if (current.length > 1) result.push(current.join(' '))
      current = []
    }
    current.push(`${point.x},${point.y}`)
    lastIndex = point.index
  }
  if (current.length > 1) result.push(current.join(' '))
  return result
})

const areaPath = computed(() => {
  if (points.value.length < 2) {
    return ''
  }
  const baseline = CHART.value.top + plot.value.height
  const line = points.value.map(point => `${point.x},${point.y}`).join(' L ')
  const first = points.value[0]!
  const last = points.value[points.value.length - 1]!
  return `M ${first.x},${baseline} L ${line} L ${last.x},${baseline} Z`
})

const gridLines = computed(() => {
  const bounds = scale.value
  if (!bounds) {
    return []
  }
  return [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const weight = bounds.max - ratio * (bounds.max - bounds.min)
    return { y: CHART.value.top + ratio * plot.value.height, label: weight.toFixed(1) }
  })
})

const targetY = computed(() => {
  const bounds = scale.value
  if (props.targetWeightKg == null || !bounds) {
    return null
  }
  return yFor(props.targetWeightKg)
})
</script>

<template>
  <svg
    v-if="points.length"
    :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
    class="w-full"
    role="img"
    aria-label="Weight over the last 12 weeks"
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

    <path v-if="areaPath" :d="areaPath" fill="currentColor" class="text-ink/10" />

    <line
      v-if="targetY !== null"
      :x1="CHART.left"
      :x2="CHART.width - CHART.right"
      :y1="targetY"
      :y2="targetY"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-dasharray="6 5"
      class="text-teal"
    />

    <polyline
      v-for="(segment, index) in segments"
      :key="`segment-${index}`"
      :points="segment"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-ink"
    />

    <g>
      <circle
        v-for="point in points"
        :key="`dot-${point.weekKey}`"
        :cx="point.x"
        :cy="point.y"
        r="4"
        fill="currentColor"
        class="text-ink"
      >
        <title>{{ point.label }} — {{ point.weightKg.toFixed(1) }} kg</title>
      </circle>
    </g>

    <g>
      <text
        v-for="(point, index) in series"
        :key="`x-${point.weekKey}`"
        :x="xFor(index)"
        :y="CHART.height - 8"
        text-anchor="middle"
        font-size="11"
        fill="currentColor"
        class="text-muted"
      >
        {{ index % 2 === 0 ? point.label : '' }}
      </text>
    </g>
  </svg>

  <p v-else class="py-12 text-center text-sm text-muted">
    <slot name="empty">No weigh-ins yet — the chart fills in week by week.</slot>
  </p>
</template>
