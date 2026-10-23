<script setup lang="ts">
import { APPEARANCE_KEY, type Appearance } from '~/composables/useAppTheme'

// The theme follows the profile (gender and age) unless the switch says
// otherwise; fetched here so the first render already has the right look.
await usePlannerFetch<Appearance>(APPEARANCE_KEY, '/api/me/appearance')

const { theme, info } = useAppTheme()
const isNavigationOpen = ref(false)
const route = useRoute()

watch(
  () => route.fullPath,
  () => {
    isNavigationOpen.value = false
  }
)

useHead(() => ({
  htmlAttrs: { 'data-theme': theme.value },
  link: info.value.fontsHref ? [{ rel: 'stylesheet', href: info.value.fontsHref }] : []
}))

/** Each sidebar theme brings its own menu and header; Lavender has a top bar instead. */
const shell = computed(() => {
  switch (theme.value) {
    case 'graphite':
      return { sidebar: resolveComponent('ShellGraphiteSidebar'), header: resolveComponent('ShellGraphiteHeader') }
    case 'chrome':
      return { sidebar: resolveComponent('ShellChromeSidebar'), header: resolveComponent('ShellChromeHeader') }
    case 'skate':
      return { sidebar: resolveComponent('ShellSkateSidebar'), header: resolveComponent('ShellSkateHeader') }
    default:
      return { sidebar: resolveComponent('AppSidebar'), header: resolveComponent('AppHeader') }
  }
})
</script>

<template>
  <div v-if="theme === 'lavender'" class="min-h-screen">
    <ShellLavenderHeader />
    <main class="mx-auto w-full max-w-[1400px] px-5 pb-12 pt-8 md:px-10">
      <slot />
    </main>
  </div>

  <div v-else class="min-h-screen lg:flex" :class="{ 'gap-4 p-4': theme === 'chrome' }">
    <component :is="shell.sidebar" />

    <Transition name="fade">
      <div
        v-if="isNavigationOpen"
        class="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
        @click="isNavigationOpen = false"
      />
    </Transition>

    <Transition name="slide">
      <div v-if="isNavigationOpen" class="fixed inset-y-0 left-0 z-50 lg:hidden" :class="{ 'p-3': theme === 'chrome' }">
        <component :is="shell.sidebar" mobile />
      </div>
    </Transition>

    <div class="min-w-0 flex-1">
      <component :is="shell.header" @open-navigation="isNavigationOpen = true" />
      <main
        :class="{
          'px-5 py-8 md:px-8 lg:px-10': theme === 'executive' || theme === 'graphite',
          'px-2 pb-6 pt-6': theme === 'chrome',
          'px-5 pb-12 pt-8 md:px-10': theme === 'skate'
        }"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active,
.slide-enter-active,
.slide-leave-active {
  transition: all 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-1rem);
  opacity: 0;
}
</style>
