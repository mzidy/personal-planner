<script setup lang="ts">
import { Bell, LogOut, Menu, MessageSquare, Search } from 'lucide-vue-next'

const emit = defineEmits<{
  openNavigation: []
}>()

const { user, clear } = useUserSession()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <header class="glass-shell sticky top-0 z-30 border-b ghost-divider px-5 py-4 md:px-8 lg:px-10">
    <div class="flex items-center gap-4">
      <button
        class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-low text-ink lg:hidden"
        type="button"
        @click="emit('openNavigation')"
      >
        <Menu class="h-5 w-5" />
      </button>

      <label class="relative flex-1">
        <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          class="w-full rounded-full border border-outline/20 bg-surface-low py-3 pl-11 pr-4 text-sm outline-none transition focus:border-accent/20 focus:bg-surface"
          placeholder="Search your executive suite..."
          type="search"
        />
      </label>

      <div class="hidden items-center gap-3 md:flex">
        <button class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-low text-muted transition hover:text-ink">
          <Bell class="h-4 w-4" />
        </button>
        <button class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-low text-muted transition hover:text-ink">
          <MessageSquare class="h-4 w-4" />
        </button>
      </div>

      <div class="flex items-center gap-3 rounded-full bg-surface px-3 py-2 shadow-glass">
        <div class="hidden text-right md:block">
          <p class="text-sm font-semibold text-ink">
            {{ user?.displayName || 'Executive Member' }}
          </p>
          <p class="text-[11px] uppercase tracking-[0.18em] text-muted">
            {{ user?.email || 'Secure workspace' }}
          </p>
        </div>

        <div class="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
          {{ user?.avatarInitials || 'SE' }}
        </div>

        <button
          class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-low text-muted transition hover:text-ink"
          type="button"
          @click="logout"
        >
          <LogOut class="h-4 w-4" />
        </button>
      </div>
    </div>
  </header>
</template>
