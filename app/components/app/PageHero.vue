<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  subtitle?: string
}>()
</script>

<template>
  <section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div class="max-w-3xl space-y-3">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.06em] text-ink md:text-6xl">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="max-w-2xl text-base leading-7 text-muted md:text-lg">
        {{ subtitle }}
      </p>
    </div>
    <div class="shrink-0">
      <slot name="aside" />
    </div>
  </section>
</template>
