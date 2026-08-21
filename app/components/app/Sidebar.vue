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

function isParentActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function isChildActive(target: string) {
  return route.path === target
}
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
      <div v-for="item in navigation" :key="item.to" class="space-y-2">
        <NuxtLink
          :to="item.to"
          class="relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200"
          :class="
            isParentActive(item.to)
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

        <div
          v-if="item.children?.length && isParentActive(item.to)"
          class="ml-5 space-y-1 border-l border-outline/10 pl-4"
        >
          <NuxtLink
            v-for="child in item.children"
            :key="child.to"
            :to="child.to"
            class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-200"
            :class="
              isChildActive(child.to)
                ? 'bg-surface text-ink'
                : 'text-muted hover:bg-surface hover:text-ink'
            "
          >
            <component :is="child.icon" class="h-3.5 w-3.5" />
            <span>{{ child.label }}</span>
          </NuxtLink>
        </div>
      </div>
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
