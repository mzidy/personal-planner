<script setup lang="ts">
withDefaults(defineProps<{ mobile?: boolean }>(), { mobile: false })

const navigation = useNavigation()
const { isParentActive, isChildActive } = useNavActive()
const { firstName } = useAppTheme()

const chrome = 'bg-gradient-to-br from-white to-[#DCDDE6] border-[3px] border-white shadow-[inset_0_0_0_1px_#B8BCC9,0_16px_40px_rgba(31,21,53,0.14)]'
</script>

<template>
  <aside
    class="w-[248px] shrink-0 flex-col gap-6 rounded-[32px] px-[18px] py-6 text-[#1F1535]"
    :class="[chrome, mobile ? 'flex h-full overflow-y-auto overflow-x-hidden' : 'sticky top-4 hidden h-[calc(100vh-2rem)] self-start overflow-y-auto overflow-x-hidden lg:flex']"
  >
    <NuxtLink to="/dashboard" class="rounded-[20px] bg-[#1F1535] px-3 py-3 text-white">
      <span class="block whitespace-nowrap font-display text-base font-extrabold uppercase tracking-[-0.04em]">my✦planner</span>
      <span class="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#4FD3FF]">{{ firstName || 'you' }} · v2.0</span>
    </NuxtLink>

    <nav class="flex flex-1 flex-col gap-1.5">
      <template v-for="item in navigation" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="rounded-full px-4 py-2.5 transition"
          :class="[
            item.accent ? 'mt-1.5' : '',
            isParentActive(item)
              ? 'bg-[#FF3FA4] font-extrabold text-white shadow-[0_6px_16px_rgba(255,63,164,0.4)]'
              : item.accent
                ? 'bg-[#1F1535] font-extrabold text-[#4FD3FF]'
                : 'font-bold hover:bg-white/70'
          ]"
        >
          {{ item.label }}
        </NuxtLink>
        <div v-if="item.children?.length && isParentActive(item)" class="ml-4 flex flex-col gap-0.5 border-l-2 border-[#FF3FA4]/30 pl-3">
          <NuxtLink
            v-for="child in item.children"
            :key="child.to"
            :to="child.to"
            class="rounded-full px-3 py-1.5 text-sm font-bold transition"
            :class="isChildActive(child) ? 'bg-white text-[#C2187A]' : 'text-[#5F5577] hover:text-[#1F1535]'"
          >
            {{ child.label }}
          </NuxtLink>
        </div>
      </template>
    </nav>

    <span class="px-4 py-2.5 text-[13px] font-bold text-[#5F5577]">Settings</span>
  </aside>
</template>
