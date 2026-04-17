<script setup lang="ts">
withDefaults(
  defineProps<{
    mobile?: boolean
  }>(),
  {
    mobile: false
  }
)

const navigation = useNavigation()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
</script>

<template>
  <div
    class="w-72 shrink-0 border-r ghost-divider bg-gradient-to-b from-surface to-surface-low px-7 py-8"
    :class="mobile ? 'flex h-full flex-col' : 'hidden lg:flex lg:flex-col'"
  >
    <div>
      <p class="font-display text-xl font-extrabold tracking-[-0.04em] text-ink">
        {{ runtimeConfig.public.appName }}
      </p>
      <p class="mt-1 text-xs uppercase tracking-[0.22em] text-muted">
        {{ runtimeConfig.public.appTagline }}
      </p>
    </div>

    <nav class="mt-10 flex-1 space-y-2">
      <NuxtLink
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        class="relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200"
        :class="
          route.path === item.to
            ? item.accent
              ? 'bg-ink text-white nav-active'
              : 'bg-surface text-ink nav-active'
            : item.accent
              ? 'bg-ink/95 text-white hover:bg-ink'
              : 'text-muted hover:bg-surface hover:text-ink'
        "
      >
        <component :is="item.icon" class="h-4 w-4" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <div class="space-y-2 border-t ghost-divider pt-6 text-sm">
      <button class="w-full rounded-2xl bg-surface px-4 py-3 text-left font-medium text-muted transition hover:text-ink">
        Settings
      </button>
      <button class="w-full rounded-2xl bg-surface px-4 py-3 text-left font-medium text-muted transition hover:text-ink">
        Support
      </button>
    </div>
  </div>
</template>
