<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    tone?: 'ink' | 'teal' | 'mist' | 'danger'
  }>(),
  {
    tone: 'mist'
  }
)

const classes = computed(() => {
  if (props.tone === 'ink') {
    return 'bg-ink text-white'
  }

  if (props.tone === 'teal') {
    return 'bg-teal/20 text-accent'
  }

  if (props.tone === 'danger') {
    return 'bg-rose-100 text-rose-700'
  }

  return 'bg-surface-low text-muted'
})
</script>

<template>
  <span class="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" :class="classes">
    {{ label }}
  </span>
</template>
