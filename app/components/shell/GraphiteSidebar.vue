<script setup lang="ts">
import { Mic } from 'lucide-vue-next'

withDefaults(defineProps<{ mobile?: boolean }>(), { mobile: false })

const navigation = useNavigation()
const { isParentActive, isChildActive } = useNavActive()
const route = useRoute()

const main = computed(() => navigation.value.filter(item => !item.accent))
const ai = computed(() => navigation.value.filter(item => item.accent))

/** "AI Assistant" reads as "Assistant" under the AI heading. */
const aiLabel = (label: string) => label.replace(/^AI\s+/, '')
</script>

<template>
  <aside
    class="w-[248px] shrink-0 flex-col gap-8 border-r border-[#2B2F36] bg-[#121418] px-5 py-7 text-[#9AA1AC]"
    :class="mobile ? 'flex h-full overflow-y-auto' : 'sticky top-0 hidden h-screen overflow-y-auto lg:flex'"
  >
    <NuxtLink to="/dashboard" class="flex items-center gap-3">
      <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#38D5F0] font-display font-bold text-[#15171B]">SE</span>
      <span>
        <span class="block font-display font-bold tracking-[-0.02em] text-[#E8EAEE]">Serene Executive</span>
        <span class="block text-[11px]">Digital concierge</span>
      </span>
    </NuxtLink>

    <nav class="flex flex-1 flex-col gap-0.5 text-sm">
      <template v-for="item in main" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 transition-colors"
          :class="
            isParentActive(item)
              ? 'border-[#38D5F0] bg-[#1E2126] font-semibold text-[#E8EAEE]'
              : 'border-transparent hover:bg-[#1E2126] hover:text-[#E8EAEE]'
          "
        >
          <component :is="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </NuxtLink>
        <div v-if="item.children?.length && isParentActive(item)" class="mb-1 ml-5 space-y-0.5 border-l border-[#2B2F36] pl-3">
          <NuxtLink
            v-for="child in item.children"
            :key="child.to"
            :to="child.to"
            class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors"
            :class="isChildActive(child) ? 'text-[#E8EAEE]' : 'hover:text-[#E8EAEE]'"
          >
            <component :is="child.icon" class="h-3.5 w-3.5" />
            {{ child.label }}
          </NuxtLink>
        </div>
      </template>

      <p class="mx-3 mb-1 mt-4 text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">AI</p>
      <template v-for="item in ai" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold text-[#38D5F0] transition-colors hover:bg-[#1E2126]"
          :class="{ 'bg-[#1E2126]': isParentActive(item) }"
        >
          <component :is="item.icon" class="h-4 w-4" />
          {{ aiLabel(item.label) }}
        </NuxtLink>
        <div v-if="item.children?.length && isParentActive(item)" class="mb-1 ml-5 space-y-0.5 border-l border-[#2B2F36] pl-3">
          <NuxtLink
            v-for="child in item.children"
            :key="child.to"
            :to="child.to"
            class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors"
            :class="isChildActive(child) ? 'text-[#E8EAEE]' : 'hover:text-[#E8EAEE]'"
          >
            <component :is="child.icon" class="h-3.5 w-3.5" />
            {{ child.label }}
          </NuxtLink>
        </div>
      </template>
    </nav>

    <div class="flex flex-col gap-0.5 border-t border-[#2B2F36] pt-4 text-sm">
      <NuxtLink
        to="/voice"
        class="flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors hover:text-[#E8EAEE]"
        :class="{ 'bg-[#1E2126] text-[#E8EAEE]': route.path === '/voice' }"
      >
        <Mic class="h-4 w-4" /> Voice control
      </NuxtLink>
      <span class="px-3 py-2.5">Settings</span>
    </div>
  </aside>
</template>
