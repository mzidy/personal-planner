<script setup lang="ts">
const appName = useRuntimeConfig().public.appName as string

// A page's own title goes first ("Smart Home · The Serene Executive"); a page
// without one shows the name once rather than "Name · Name".
useHead({
  titleTemplate: title => (title && title !== appName ? `${title} · ${appName}` : appName)
})
</script>

<template>
  <div class="min-h-screen bg-background text-ink">
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator color="#0f172a" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
