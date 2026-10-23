<script setup lang="ts">
import { Menu, Search } from 'lucide-vue-next'

const emit = defineEmits<{ openNavigation: [] }>()
const { user } = useUserSession()

const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const box = 'border-2 border-[#18242A] bg-white'
</script>

<template>
  <header class="flex items-center gap-3 px-5 pt-6 md:px-10">
    <button
      type="button"
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] lg:hidden"
      :class="box"
      aria-label="Open menu"
      @click="emit('openNavigation')"
    >
      <Menu class="h-5 w-5" />
    </button>
    <label class="flex min-w-0 max-w-[420px] flex-1 items-center gap-2.5 rounded-[14px] px-4 py-3 text-[#5A6A70]" :class="box">
      <Search class="h-4 w-4 shrink-0" :stroke-width="2.5" />
      <input type="search" placeholder="Search…" class="min-w-0 flex-1 border-0 bg-transparent font-medium text-[#18242A] outline-none" />
    </label>
    <div class="ml-auto flex items-center gap-2.5">
      <p class="hidden rounded-[14px] px-3.5 py-2 font-bold sm:block" :class="box">{{ today }}</p>
      <ShellThemeMenu :trigger-class="`flex h-11 w-11 items-center justify-center rounded-[14px] ${box}`" />
      <span class="flex h-11 w-11 items-center justify-center rounded-[14px] border-2 border-[#18242A] bg-[#F26B1D] font-black text-white">
        {{ (user?.displayName || 'L').charAt(0).toUpperCase() }}
      </span>
    </div>
  </header>
</template>
