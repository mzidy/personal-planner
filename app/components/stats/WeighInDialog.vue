<script setup lang="ts">
import type { WeighInRecord } from '~~/shared/types/stats'
import { todayIso, weighInWeek } from '~~/shared/utils/weigh-in'

const props = defineProps<{ history: WeighInRecord[] }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const date = ref(todayIso())
const title = computed(() => weighInWeek(date.value, props.history).title)
</script>

<template>
  <TradesDialog eyebrow="Weekly weigh-in" :title="title" @close="emit('close')">
    <StatsWeighInForm v-model:date="date" :history="history" @saved="emit('saved')" />
  </TradesDialog>
</template>
