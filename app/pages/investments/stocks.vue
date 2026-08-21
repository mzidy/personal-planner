<script setup lang="ts">
import InvestmentSectionView from '~/components/investments/InvestmentSectionView.vue'

definePageMeta({
  middleware: 'protected'
})
</script>

<template>
  <InvestmentSectionView kind="stock" />
</template>
