<script setup lang="ts">
const isNavigationOpen = ref(false)
</script>

<template>
  <div class="min-h-screen lg:flex">
    <AppSidebar />

    <Transition name="fade">
      <div
        v-if="isNavigationOpen"
        class="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm lg:hidden"
        @click="isNavigationOpen = false"
      />
    </Transition>

    <Transition name="slide">
      <aside v-if="isNavigationOpen" class="fixed inset-y-0 left-0 z-50 lg:hidden">
        <AppSidebar mobile />
      </aside>
    </Transition>

    <div class="min-w-0 flex-1">
      <AppHeader @open-navigation="isNavigationOpen = true" />
      <main class="px-5 py-8 md:px-8 lg:px-10">
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
