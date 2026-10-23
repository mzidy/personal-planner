<script setup lang="ts">
import { Bell, Menu, Search, X } from 'lucide-vue-next'

/**
 * Lavender has no sidebar: the menu is a glass pill bar along the top, and a
 * section's own pages (Finance → Investing…) show as a second row under it.
 */
const navigation = useNavigation()
const { isParentActive, isChildActive } = useNavActive()
const { user } = useUserSession()
const route = useRoute()

const menuOpen = ref(false)
const activeChildren = computed(() => navigation.value.find(item => isParentActive(item) && item.children?.length)?.children || [])

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  }
)

const glass = 'border border-white/80 bg-white/55 backdrop-blur-xl'
</script>

<template>
  <header class="px-5 pt-5 md:px-10">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-4 2xl:gap-x-6">
      <NuxtLink to="/dashboard" class="mr-2 font-display text-xl font-extrabold tracking-[-0.03em] text-[#26233A]">
        Serene<span class="text-[#8B7BD8]">.</span>
      </NuxtLink>

      <nav class="hidden flex-wrap gap-1 rounded-full p-1.5 xl:flex" :class="glass">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="rounded-full px-3 py-2 text-sm transition-colors 2xl:px-4"
          :class="
            isParentActive(item)
              ? item.accent
                ? 'bg-gradient-to-br from-[#8B7BD8] to-[#6C7BE0] font-semibold text-white'
                : 'bg-[#26233A] font-semibold text-white'
              : item.accent
                ? 'bg-gradient-to-br from-[#8B7BD8]/90 to-[#6C7BE0]/90 font-semibold text-white'
                : 'font-medium text-[#4F4A6B] hover:bg-white/70'
          "
        >
          {{ item.short || item.label }}
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-2.5">
        <!-- Search and notifications are not wired up yet; shown only where the bar has room. -->
        <button type="button" aria-label="Search" class="hidden h-11 w-11 items-center justify-center rounded-full text-[#4F4A6B] 2xl:flex" :class="glass">
          <Search class="h-4 w-4" />
        </button>
        <button type="button" aria-label="Notifications" class="hidden h-11 w-11 items-center justify-center rounded-full text-[#4F4A6B] 2xl:flex" :class="glass">
          <Bell class="h-4 w-4" />
        </button>
        <ShellThemeMenu :trigger-class="`flex h-11 w-11 items-center justify-center rounded-full text-[#4F4A6B] ${glass}`" />
        <span class="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#8B7BD8] to-[#D6A3D6] text-[13px] font-bold text-white">
          {{ user?.avatarInitials || 'SE' }}
        </span>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full text-[#4F4A6B] xl:hidden"
          :class="glass"
          :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
          @click="menuOpen = !menuOpen"
        >
          <X v-if="menuOpen" class="h-4 w-4" />
          <Menu v-else class="h-4 w-4" />
        </button>
      </div>
    </div>

    <nav v-if="menuOpen" class="mt-4 grid gap-1 rounded-[28px] p-2 sm:grid-cols-2 xl:hidden" :class="glass">
      <NuxtLink
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        class="rounded-full px-4 py-2.5 text-sm"
        :class="isParentActive(item) ? 'bg-[#26233A] font-semibold text-white' : 'font-medium text-[#4F4A6B]'"
      >
        {{ item.label }}
      </NuxtLink>
    </nav>

    <nav v-if="activeChildren.length > 1" class="mt-3 flex flex-wrap gap-1.5">
      <NuxtLink
        v-for="child in activeChildren"
        :key="child.to"
        :to="child.to"
        class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
        :class="isChildActive(child) ? 'bg-white text-[#5B4BC4] shadow-[0_8px_20px_rgba(76,60,160,0.12)]' : 'text-[#6B6880] hover:bg-white/60'"
      >
        {{ child.label }}
      </NuxtLink>
    </nav>
  </header>
</template>
