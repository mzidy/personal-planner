<script setup lang="ts">
const model = defineModel<string>({ required: true })

withDefaults(
  defineProps<{
    label: string
    kind?: 'text' | 'amount' | 'date' | 'ticker'
    placeholder?: string
    hint?: string
  }>(),
  { kind: 'text', placeholder: '', hint: '' }
)
</script>

<template>
  <label class="block min-w-0">
    <span class="eyebrow">{{ label }}</span>
    <!-- Amounts are text with a decimal keypad, so a decimal comma is accepted rather than silently dropped. -->
    <input
      v-model="model"
      class="mt-2 w-full min-w-0 rounded-2xl bg-surface-low px-4 py-3 text-sm outline-none"
      :class="{ uppercase: kind === 'ticker', 'tabular-nums': kind === 'amount' }"
      :type="kind === 'date' ? 'date' : 'text'"
      :inputmode="kind === 'amount' ? 'decimal' : undefined"
      :maxlength="kind === 'ticker' ? 15 : undefined"
      :autocapitalize="kind === 'ticker' ? 'characters' : undefined"
      :spellcheck="kind === 'text'"
      :placeholder="placeholder"
    />
    <span v-if="hint || $slots.hint" class="mt-1.5 block text-xs leading-5 text-muted">
      <slot name="hint">{{ hint }}</slot>
    </span>
  </label>
</template>
