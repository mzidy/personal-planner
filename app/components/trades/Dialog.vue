<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{ eyebrow: string; title: string }>()
const emit = defineEmits<{ close: [] }>()

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @click.self="emit('close')"
    >
      <div class="max-h-full w-full max-w-2xl space-y-5 overflow-auto rounded-panel bg-surface p-5 text-ink shadow-ambient sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="eyebrow">{{ eyebrow }}</p>
            <h3 class="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">{{ title }}</h3>
          </div>
          <button class="rounded-full bg-surface-low p-2 text-muted transition hover:text-ink" title="Close" @click="emit('close')">
            <X class="h-4 w-4" />
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
