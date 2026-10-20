<script setup lang="ts">
import type { ClaudemyCard } from '~~/shared/types/claudemy'

defineProps<{
  card: ClaudemyCard
  nextNumber: number | null
}>()
</script>

<template>
  <div class="space-y-5 text-sm leading-6">
    <div>
      <p class="eyebrow">The idea, in three lines</p>
      <ul class="mt-2 space-y-1.5">
        <li v-for="(line, index) in card.ideaLines" :key="index" class="flex gap-2">
          <span class="text-muted">·</span>
          <span>{{ line }}</span>
        </li>
      </ul>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <p class="eyebrow">Impact</p>
        <p class="mt-1">{{ card.impact }}</p>
      </div>
      <div>
        <p class="eyebrow">Who says it</p>
        <p class="mt-1">{{ card.whoSaysIt }}</p>
      </div>
    </div>

    <div class="rounded-soft bg-surface-low px-5 py-4">
      <p class="eyebrow">Try it · {{ card.tryIt.energy }} · {{ card.tryIt.minutes }} min</p>
      <p class="mt-2 whitespace-pre-line">{{ card.tryIt.steps }}</p>
    </div>

    <div>
      <p class="eyebrow">Rule to keep</p>
      <p class="mt-1 font-semibold">{{ card.rule }}</p>
    </div>

    <p class="text-muted">
      <span class="font-semibold">Skip</span> · no cost, no catch-up.
      <template v-if="nextNumber">Lesson {{ nextNumber }} is just lesson {{ nextNumber }}.</template>
    </p>

    <div v-if="card.deeper.length">
      <p class="eyebrow">Go deeper (optional)</p>
      <ul class="mt-2 space-y-1">
        <li v-for="link in card.deeper" :key="link.url">
          {{ link.label }}:
          <a class="break-all text-accent underline-offset-2 hover:underline" :href="link.url" target="_blank" rel="noopener noreferrer">
            {{ link.url }}
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>
