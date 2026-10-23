<script setup lang="ts">
import { Check, LogOut, Palette } from 'lucide-vue-next'
import { THEMES, THEME_INFO, type ThemeChoice } from '~~/shared/utils/themes'

/**
 * The color scheme switch: follow the profile ("auto") or pick any design to
 * try it. Also holds the menu size (basic / extended) for the adult themes and
 * sign-out, since the designs' headers have no room for either.
 */
withDefaults(defineProps<{ triggerClass?: string; align?: 'left' | 'right'; up?: boolean }>(), {
  triggerClass: '',
  align: 'right',
  up: false
})

const { choice, detected, isTeen, setChoice } = useAppTheme()
const { mode, setMode } = useViewMode()
const signOut = useSignOut()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const options = computed(() => [
  { value: 'auto' as ThemeChoice, label: 'Auto', detail: `${THEME_INFO[detected.value].label}, from your profile` },
  ...THEMES.map(theme => ({ value: theme as ThemeChoice, label: THEME_INFO[theme].label, detail: THEME_INFO[theme].audience }))
])

function pick(value: ThemeChoice) {
  setChoice(value)
  open.value = false
}

function onDocumentClick(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) {
    open.value = false
  }
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      :class="triggerClass"
      title="Color scheme"
      aria-label="Color scheme and account"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Palette class="h-4 w-4" />
    </button>

    <div
      v-if="open"
      class="absolute z-50 w-72 space-y-4 rounded-2xl border border-outline/20 bg-surface p-4 text-left font-body text-ink shadow-ambient"
      :class="[align === 'right' ? 'right-0' : 'left-0', up ? 'bottom-full mb-2' : 'top-full mt-2']"
    >
      <div>
        <p class="eyebrow">Color scheme</p>
        <ul class="mt-2 space-y-1" role="radiogroup" aria-label="Color scheme">
          <li v-for="option in options" :key="option.value">
            <button
              type="button"
              role="radio"
              :aria-checked="choice === option.value"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface-low"
              @click="pick(option.value)"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold">{{ option.label }}</span>
                <span class="block truncate text-xs text-muted">{{ option.detail }}</span>
              </span>
              <Check v-if="choice === option.value" class="h-4 w-4 shrink-0 text-accent" />
            </button>
          </li>
        </ul>
      </div>

      <div v-if="!isTeen">
        <p class="eyebrow">Menu</p>
        <div class="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-surface-low p-1 text-xs font-semibold" role="radiogroup" aria-label="Menu size">
          <button
            v-for="option in (['basic', 'extended'] as const)"
            :key="option"
            type="button"
            role="radio"
            :aria-checked="mode === option"
            class="rounded-lg px-3 py-2 uppercase tracking-[0.12em] transition-colors"
            :class="mode === option ? 'bg-surface text-ink shadow-glass' : 'text-muted hover:text-ink'"
            @click="setMode(option)"
          >
            {{ option === 'basic' ? 'Basic' : 'Extended' }}
          </button>
        </div>
      </div>

      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-low hover:text-ink"
        @click="signOut"
      >
        <LogOut class="h-4 w-4" /> Sign out
      </button>
    </div>
  </div>
</template>
