<script setup lang="ts">
/**
 * The Finance pages' own tabs: the sidebar's Finance entries that live under
 * /finance, so basic view hides exactly what the sidebar hides.
 */
const navigation = useNavigation()
const route = useRoute()

const tabs = computed(
  () => navigation.value.find(item => item.to === '/finance')?.children?.filter(child => child.to.startsWith('/finance')) || []
)
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="rounded-full px-4 py-2 text-sm font-medium transition"
      :class="route.path === tab.to ? 'bg-ink text-white' : 'bg-surface-low text-muted hover:bg-surface hover:text-ink'"
    >
      {{ tab.label }}
    </NuxtLink>
  </div>
</template>
