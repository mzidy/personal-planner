<script setup lang="ts">
definePageMeta({
  middleware: 'protected'
})

// Each theme has its own home page; executive is the original one.
const { theme } = useAppTheme()
</script>

<template>
  <HomeGraphite v-if="theme === 'graphite'" />
  <HomeLavender v-else-if="theme === 'lavender'" />
  <HomeChrome v-else-if="theme === 'chrome'" />
  <HomeSkate v-else-if="theme === 'skate'" />
  <HomeExecutive v-else />
</template>
