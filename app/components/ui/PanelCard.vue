<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    as?: string
    tone?: 'light' | 'muted' | 'dark'
    padded?: boolean
  }>(),
  {
    as: 'section',
    tone: 'light',
    padded: true
  }
)

const toneClass = computed(() => {
  if (props.tone === 'dark') {
    return 'bg-executive-dark text-white shadow-glass'
  }

  if (props.tone === 'muted') {
    return 'bg-surface-low text-ink'
  }

  return 'bg-surface text-ink shadow-ambient'
})
</script>

<template>
  <component
    :is="as"
    class="rounded-panel transition-all duration-200"
    :class="[toneClass, padded ? 'p-6 md:p-8' : '']"
  >
    <slot />
  </component>
</template>
