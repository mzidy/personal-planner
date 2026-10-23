<script setup lang="ts">
import { Menu, Search } from 'lucide-vue-next'

const emit = defineEmits<{ openNavigation: [] }>()
const { user } = useUserSession()

const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
</script>

<template>
  <header
    class="flex items-center gap-3 rounded-full border-[3px] border-white bg-gradient-to-br from-white to-[#DCDDE6] py-2.5 pl-5 pr-2.5 shadow-[inset_0_0_0_1px_#B8BCC9]"
  >
    <button type="button" class="text-[#5F5577] lg:hidden" aria-label="Open menu" @click="emit('openNavigation')">
      <Menu class="h-5 w-5" />
    </button>
    <label class="flex min-w-0 flex-1 items-center gap-2.5 text-[#5F5577]">
      <Search class="h-4 w-4 shrink-0" :stroke-width="2.5" />
      <input type="search" placeholder="search ✦" class="min-w-0 flex-1 border-0 bg-transparent font-bold text-[#1F1535] outline-none placeholder:text-[#5F5577]" />
    </label>
    <p class="hidden rounded-full bg-[#1F1535] px-3.5 py-2 text-[13px] font-extrabold text-white sm:block">{{ today }}</p>
    <ShellThemeMenu trigger-class="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-white/70 text-[#1F1535] shadow-[inset_0_0_0_1px_#B8BCC9]" />
    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF3FA4] to-[#4FD3FF] font-display font-extrabold text-white">
      {{ (user?.displayName || 'N').charAt(0).toUpperCase() }}
    </span>
  </header>
</template>
