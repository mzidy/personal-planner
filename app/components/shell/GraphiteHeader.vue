<script setup lang="ts">
import { Bell, Menu, Search } from 'lucide-vue-next'

const emit = defineEmits<{ openNavigation: [] }>()
const { user } = useUserSession()
const { firstName } = useAppTheme()
</script>

<template>
  <header class="sticky top-0 z-30 flex items-center gap-4 border-b border-[#2B2F36] bg-[#15171B]/95 px-5 py-4 backdrop-blur md:px-8">
    <button
      type="button"
      class="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2B2F36] bg-[#1E2126] text-[#9AA1AC] lg:hidden"
      aria-label="Open menu"
      @click="emit('openNavigation')"
    >
      <Menu class="h-4 w-4" />
    </button>
    <label class="flex max-w-[520px] flex-1 items-center gap-2.5 rounded-lg border border-[#2B2F36] bg-[#1E2126] px-3.5 py-2.5 text-[#9AA1AC]">
      <Search class="h-4 w-4 shrink-0" />
      <input type="search" placeholder="Search…  ⌘K" class="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#E8EAEE] outline-none" />
    </label>
    <div class="ml-auto flex items-center gap-2.5">
      <button
        type="button"
        aria-label="Notifications"
        class="hidden h-10 w-10 items-center justify-center rounded-lg border border-[#2B2F36] bg-[#1E2126] text-[#9AA1AC] sm:flex"
      >
        <Bell class="h-4 w-4" />
      </button>
      <ShellThemeMenu
        trigger-class="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2B2F36] bg-[#1E2126] text-[#9AA1AC] transition hover:text-[#38D5F0]"
      />
      <div class="flex items-center gap-2.5 rounded-lg border border-[#2B2F36] bg-[#1E2126] py-1 pl-1 pr-3">
        <span class="flex h-8 w-8 items-center justify-center rounded-md bg-[#2B2F36] font-display text-xs font-bold text-[#38D5F0]">
          {{ user?.avatarInitials || 'SE' }}
        </span>
        <span class="hidden text-sm font-semibold text-[#E8EAEE] sm:inline">{{ firstName }}</span>
      </div>
    </div>
  </header>
</template>
