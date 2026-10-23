<script setup lang="ts">
import type { WeeklyPoint } from '~~/shared/types/stats'

/**
 * The weight line from the Graphite and Lavender designs: weekly weigh-ins
 * across the last twelve weeks, with the target as a dashed line. Weeks
 * without a weigh-in leave a gap in spacing but not in the line.
 */
const props = defineProps<{
  series: WeeklyPoint[]
  target?: number | null
  variant: 'graphite' | 'lavender'
}>()

const size = computed(() =>
  props.variant === 'graphite' ? { width: 600, height: 220, left: 24, top: 40, bottom: 190 } : { width: 700, height: 200, left: 0, top: 30, bottom: 170 }
)

const points = computed(() => props.series.map((point, index) => ({ index, kg: point.weightKg })).filter(point => point.kg !== null) as { index: number; kg: number }[])

const scale = computed(() => {
  const values = points.value.map(point => point.kg)
  if (props.target) {
    values.push(props.target)
  }
  const low = Math.floor(Math.min(...values) - 0.5)
  const high = Math.ceil(Math.max(...values) + 0.5)
  return { low, high: high === low ? low + 1 : high }
})

function x(index: number) {
  const { width, left } = size.value
  const steps = Math.max(1, props.series.length - 1)
  return left + (index / steps) * (width - left)
}

function y(kg: number) {
  const { top, bottom } = size.value
  const { low, high } = scale.value
  return bottom - ((kg - low) / (high - low)) * (bottom - top)
}

const line = computed(() => points.value.map((point, i) => `${i ? 'L' : 'M'}${x(point.index).toFixed(1)} ${y(point.kg).toFixed(1)}`).join(' '))
const area = computed(() => {
  if (points.value.length < 2) {
    return ''
  }
  const first = points.value[0]!
  const last = points.value[points.value.length - 1]!
  return `${line.value} L${x(last.index).toFixed(1)} ${size.value.height} L${x(first.index).toFixed(1)} ${size.value.height} Z`
})
const last = computed(() => points.value[points.value.length - 1])

/** Four evenly spaced gridlines with their kilograms, as in Graphite. */
const grid = computed(() => {
  const { low, high } = scale.value
  return [0, 1, 2, 3].map(step => {
    const kg = high - ((high - low) * step) / 3
    return { kg: Math.round(kg * 10) / 10, y: y(kg) }
  })
})

const gradientId = `weight-fill-${useId()}`
</script>

<template>
  <svg
    v-if="points.length >= 2"
    role="img"
    :aria-label="`Weight over the last ${series.length} weeks`"
    :viewBox="`0 0 ${size.width} ${size.height}`"
    class="block h-auto w-full"
  >
    <template v-if="variant === 'graphite'">
      <g v-for="row in grid" :key="row.kg">
        <line x1="0" :x2="size.width" :y1="row.y" :y2="row.y" stroke="#2B2F36" />
        <text x="0" :y="row.y - 4" font-size="10" fill="#6B7280">{{ row.kg }}</text>
      </g>
      <line v-if="target" :x1="size.left" :x2="size.width" :y1="y(target)" :y2="y(target)" stroke="#38D5F0" stroke-opacity="0.5" stroke-dasharray="4 6" />
      <path :d="line" fill="none" stroke="#38D5F0" stroke-width="2" stroke-linejoin="round" />
      <circle v-if="last" :cx="x(last.index)" :cy="y(last.kg)" r="4" fill="#38D5F0" />
    </template>

    <template v-else>
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8B7BD8" stop-opacity="0.45" />
          <stop offset="1" stop-color="#8B7BD8" stop-opacity="0" />
        </linearGradient>
      </defs>
      <template v-if="target">
        <line x1="0" :x2="size.width" :y1="y(target)" :y2="y(target)" stroke="#6C7BE0" stroke-dasharray="3 7" />
        <text x="6" :y="y(target) - 6" font-size="11" font-weight="600" fill="#5B4BC4">target {{ target }} kg</text>
      </template>
      <path :d="area" :fill="`url(#${gradientId})`" />
      <path :d="line" fill="none" stroke="#5B4BC4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <circle v-if="last" :cx="x(last.index)" :cy="y(last.kg)" r="6" fill="#FFFFFF" stroke="#5B4BC4" stroke-width="3" />
    </template>
  </svg>
  <p v-else class="py-10 text-center text-sm text-muted">
    <slot name="empty">Two weekly weigh-ins draw the line.</slot>
  </p>
</template>
