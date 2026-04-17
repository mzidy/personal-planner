<script setup lang="ts">
const { ready, loggedIn, fetch } = useUserSession()

if (!ready.value) {
  await fetch()
}

await navigateTo(loggedIn.value ? '/dashboard' : '/login', { replace: true })
</script>

<template>
  <div />
</template>
