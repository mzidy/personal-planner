<script setup lang="ts">
withDefaults(defineProps<{ mobile?: boolean }>(), { mobile: false })

const navigation = useNavigation()
const { isParentActive, isChildActive } = useNavActive()
const { firstName } = useAppTheme()
</script>

<template>
  <aside
    class="relative w-[240px] shrink-0 flex-col gap-8 overflow-hidden bg-[#0F8B8D] px-[22px] py-8 text-[#F7F4EE]"
    :class="mobile ? 'flex h-full overflow-y-auto' : 'sticky top-0 hidden h-screen overflow-y-auto lg:flex'"
  >
    <!-- The design's two circles, behind the menu; clipped so they never make it scroll. -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <span class="absolute -right-[60px] bottom-[120px] h-[180px] w-[180px] rounded-full bg-[#F26B1D] opacity-90" />
      <span class="absolute -bottom-10 -left-10 h-[120px] w-[120px] rounded-full border-[14px] border-[#F7F4EE] opacity-25" />
    </div>

    <NuxtLink to="/dashboard" class="relative">
      <span class="block text-2xl font-black uppercase italic leading-tight tracking-[-0.04em]">{{ firstName || 'My' }}'s<br />planner</span>
      <span class="mt-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-[#BFE8E8]">Roll with it</span>
    </NuxtLink>

    <nav class="relative flex flex-1 flex-col gap-1 font-bold">
      <template v-for="item in navigation" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="rounded-xl px-3.5 py-2.5 transition"
          :class="[
            item.accent ? 'mt-2' : '',
            isParentActive(item)
              ? '-rotate-1 bg-[#F7F4EE] text-[#0F8B8D]'
              : item.accent
                ? 'bg-[#18242A] text-[#F7F4EE]'
                : 'text-[#F7F4EE] hover:bg-white/10'
          ]"
        >
          {{ item.label }}
        </NuxtLink>
        <div v-if="item.children?.length && isParentActive(item)" class="ml-3 flex flex-col gap-0.5 border-l-2 border-[#BFE8E8]/40 pl-3">
          <NuxtLink
            v-for="child in item.children"
            :key="child.to"
            :to="child.to"
            class="rounded-lg px-3 py-1.5 text-sm transition"
            :class="isChildActive(child) ? 'bg-[#18242A] text-[#F7F4EE]' : 'text-[#BFE8E8] hover:text-white'"
          >
            {{ child.label }}
          </NuxtLink>
        </div>
      </template>
    </nav>

    <span class="relative px-3.5 py-2.5 text-[13px] font-medium text-[#BFE8E8]">Settings</span>
  </aside>
</template>
