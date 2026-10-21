<script setup lang="ts">
import type { VacuumMapView } from '~~/shared/types/smart-home'

const props = defineProps<{
  map: VacuumMapView
  /** The drawing fits the container's width and never grows taller than this (CSS pixels). */
  maxHeight: number
}>()

/**
 * Draws a vacuum map on a canvas: the floor plan pixel for pixel (one pixel
 * is 5 cm), scaled without smoothing, with the run's path, the dock, the
 * robot and any no-go or no-mop areas drawn crisply on top.
 */
const box = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
let observer: ResizeObserver | null = null

const ROOM_COLORS = ['#cfe3f7', '#d7efd9', '#f7e3c8', '#e6dcf5', '#f5d6dc', '#d4efee', '#f2efc9', '#e3e6ea']

function cssColor(name: string, alpha = 1) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '0 0 0'
  return `rgb(${value} / ${alpha})`
}

function parseColor(color: string): [number, number, number, number] {
  const probe = document.createElement('canvas').getContext('2d')!
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  return [r!, g!, b!, a!]
}

function floorImage() {
  const { width, height } = props.map
  const pixels = Uint8Array.from(atob(props.map.pixels), char => char.charCodeAt(0))
  const palette = new Map<number, [number, number, number, number]>([
    [1, parseColor(cssColor('--color-ink', 0.85))],
    [2, parseColor(cssColor('--color-outline', 0.55))],
    [3, parseColor(cssColor('--color-outline', 0.35))],
    [4, parseColor(cssColor('--color-muted', 0.6))]
  ])
  const image = new ImageData(width, height)
  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index]!
    if (value === 0) {
      continue
    }
    let color = palette.get(value)
    if (!color && value >= 16) {
      color = parseColor(ROOM_COLORS[(value - 16) % ROOM_COLORS.length]!)
      palette.set(value, color)
    }
    image.data.set(color || palette.get(3)!, index * 4)
  }
  const offscreen = document.createElement('canvas')
  offscreen.width = width
  offscreen.height = height
  offscreen.getContext('2d')!.putImageData(image, 0, 0)
  return offscreen
}

function draw() {
  const element = canvas.value
  const container = box.value
  if (!element || !container) {
    return
  }
  const { width, height } = props.map
  const scale = Math.min(container.clientWidth / width, props.maxHeight / height)
  const cssWidth = Math.max(1, Math.floor(width * scale))
  const cssHeight = Math.max(1, Math.floor(height * scale))
  const ratio = window.devicePixelRatio || 1

  element.style.width = `${cssWidth}px`
  element.style.height = `${cssHeight}px`
  element.width = Math.round(cssWidth * ratio)
  element.height = Math.round(cssHeight * ratio)

  const ctx = element.getContext('2d')!
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(floorImage(), 0, 0, cssWidth, cssHeight)

  // Map pixel to canvas, at the pixel's centre.
  const px = (value: number) => (value + 0.5) * scale

  const polygon = (points: number[], fill: string, stroke: string) => {
    if (points.length < 6) {
      return
    }
    ctx.beginPath()
    ctx.moveTo(px(points[0]!), px(points[1]!))
    for (let index = 2; index + 1 < points.length; index += 2) {
      ctx.lineTo(px(points[index]!), px(points[index + 1]!))
    }
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  for (const zone of props.map.zones) {
    polygon(zone, 'rgb(107 216 203 / 0.12)', 'rgb(107 216 203 / 0.9)')
  }
  for (const area of props.map.noMop) {
    polygon(area, 'rgb(147 51 234 / 0.12)', 'rgb(147 51 234 / 0.8)')
  }
  for (const area of props.map.noGo) {
    polygon(area, 'rgb(225 29 72 / 0.14)', 'rgb(225 29 72 / 0.85)')
  }
  for (const wall of props.map.walls) {
    ctx.beginPath()
    ctx.moveTo(px(wall[0]!), px(wall[1]!))
    ctx.lineTo(px(wall[2]!), px(wall[3]!))
    ctx.strokeStyle = 'rgb(225 29 72 / 0.9)'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }

  const path = props.map.path
  if (path.length >= 4) {
    ctx.beginPath()
    ctx.moveTo(px(path[0]!), px(path[1]!))
    for (let index = 2; index + 1 < path.length; index += 2) {
      ctx.lineTo(px(path[index]!), px(path[index + 1]!))
    }
    ctx.strokeStyle = cssColor('--color-ink', 0.45)
    ctx.lineWidth = Math.max(0.8, Math.min(1.6, scale * 0.6))
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const dot = (x: number, y: number, radius: number, fill: string) => {
    ctx.beginPath()
    ctx.arc(px(x), px(y), radius, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
  }
  const marker = Math.max(3.5, Math.min(7, scale * 2.2))
  if (props.map.charger) {
    dot(props.map.charger[0], props.map.charger[1], marker * 0.8, '#16a34a')
  }
  if (props.map.robot) {
    dot(props.map.robot[0], props.map.robot[1], marker, cssColor('--color-ink'))
  }
}

watch(() => [props.map, props.maxHeight], draw)

onMounted(() => {
  draw()
  if (box.value && 'ResizeObserver' in window) {
    observer = new ResizeObserver(() => draw())
    observer.observe(box.value)
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="box" class="flex w-full justify-center">
    <canvas ref="canvas" role="img" :aria-label="`Vacuum map, ${map.rooms.length} rooms`" />
  </div>
</template>
