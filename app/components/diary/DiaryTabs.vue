<script setup lang="ts">
/**
 * One definition for the three Diary pages. Declaring the row per page is how
 * the rest of the app does it, but that has already caused drift — a tab added
 * in one place and missed in another.
 */
const TABS = [
  { label: 'Overview', to: '/diary' },
  { label: 'Notes', to: '/diary/notes' },
  { label: 'Import', to: '/diary/import' }
]

const route = useRoute()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
      :class="route.path === tab.to ? 'bg-ink text-white' : 'bg-surface-low text-ink hover:bg-surface'"
    >
      {{ tab.label }}
    </NuxtLink>
  </div>
</template>
