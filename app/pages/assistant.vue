<script setup lang="ts">
import type { AiBriefPayload, DashboardPayload } from '~~/shared/types/planner'

definePageMeta({
  middleware: 'protected'
})

const { data: brief, refresh } = await usePlannerFetch<AiBriefPayload>('assistant-brief', '/api/ai/brief')
const { data: dashboard, refresh: refreshDashboard } = await usePlannerFetch<DashboardPayload>('assistant-dashboard', '/api/dashboard')

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  created?: { type: string; title: string }[]
}

const chatMessages = ref<ChatMessage[]>([])
const chatInput = ref('')
const chatBusy = ref(false)
const chatError = ref('')

async function sendChat() {
  const text = chatInput.value.trim()
  if (!text || chatBusy.value) {
    return
  }

  chatMessages.value.push({ role: 'user', text })
  chatInput.value = ''
  chatBusy.value = true
  chatError.value = ''

  try {
    const result = await $fetch<{ reply: string; created: { type: string; title: string }[] }>(
      '/api/assistant/chat',
      {
        method: 'POST',
        body: {
          messages: chatMessages.value.map(item => ({ role: item.role, content: item.text }))
        }
      }
    )

    chatMessages.value.push({ role: 'assistant', text: result.reply, created: result.created })

    if (result.created.length) {
      await Promise.all([refresh(), refreshDashboard()])
    }
  } catch (error) {
    const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
    chatError.value = fetchError?.data?.statusMessage || fetchError?.data?.message || fetchError?.message || 'Assistant request failed.'
    chatMessages.value.push({
      role: 'assistant',
      text: 'Something went wrong on my side — please try again.'
    })
  } finally {
    chatBusy.value = false
  }
}
</script>

<template>
  <div v-if="brief && dashboard" class="space-y-8">
    <AppPageHero
      eyebrow="Executive AI"
      title="Strategic brief & concierge"
      subtitle="The assistant summarizes, ranks, and coaches — and can now add goals, priorities, diary entries, time blocks, and transactions on your behalf."
    />

    <PanelCard class="space-y-5">
      <div>
        <p class="eyebrow">Concierge Actions</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Ask me to add something.</h2>
        <p class="mt-2 text-sm text-muted">
          Try “Add a goal to run a marathon” or “Block tomorrow 9–10 for deep work”. I’ll ask for anything essential
          that’s missing.
        </p>
      </div>

      <div v-if="chatMessages.length" class="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
        <div
          v-for="(message, index) in chatMessages"
          :key="index"
          class="max-w-2xl rounded-[1.75rem] px-5 py-4 text-sm leading-7"
          :class="message.role === 'user' ? 'ml-auto bg-ink text-white' : 'bg-surface-low text-ink'"
        >
          <p class="whitespace-pre-line">{{ message.text }}</p>
          <div v-if="message.created?.length" class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="item in message.created"
              :key="`${item.type}-${item.title}`"
              class="rounded-full bg-[#d7e5fb] px-3 py-1 text-xs font-semibold text-accent"
            >
              + {{ item.type }}: {{ item.title }}
            </span>
          </div>
        </div>
        <p v-if="chatBusy" class="text-sm text-muted">Thinking…</p>
      </div>

      <p v-if="chatError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ chatError }}
      </p>

      <form class="flex gap-3" @submit.prevent="sendChat">
        <input
          v-model="chatInput"
          class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
          type="text"
          placeholder="Add one goal, block time, log an expense…"
          :disabled="chatBusy"
        />
        <button
          class="shrink-0 rounded-full bg-ink px-6 py-3 font-semibold text-white disabled:opacity-50"
          :disabled="chatBusy || !chatInput.trim()"
        >
          Send
        </button>
      </form>
    </PanelCard>

    <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <PanelCard class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="eyebrow">Concierge Session</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ brief.headline }}</h2>
          </div>
          <button class="rounded-full bg-surface-low px-4 py-2 text-sm font-semibold text-ink" @click="refresh()">
            Refresh brief
          </button>
        </div>

        <div class="space-y-4">
          <div class="max-w-3xl rounded-[1.75rem] bg-surface-low px-5 py-5 text-sm leading-7 text-ink">
            {{ brief.summary }}
          </div>
          <div
            v-for="item in brief.recommendations"
            :key="item"
            class="max-w-2xl rounded-[1.75rem] bg-[#d7e5fb] px-5 py-4 text-sm leading-7 text-accent"
          >
            {{ item }}
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <div v-for="metric in brief.metrics" :key="metric.label" class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">{{ metric.label }}</p>
            <p class="mt-2 text-xl font-semibold">{{ metric.value }}</p>
          </div>
        </div>
      </PanelCard>

      <div class="grid gap-6">
        <PanelCard tone="dark" class="space-y-4">
          <div>
            <p class="eyebrow text-white/55">Critical Focus</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Open priorities</h2>
          </div>
          <div class="space-y-3">
            <div v-for="item in dashboard.objectives.slice(0, 3)" :key="item.id" class="rounded-soft bg-white/6 px-4 py-4">
              <p class="font-semibold text-white">{{ item.title }}</p>
              <p class="mt-2 text-sm leading-6 text-white/70">{{ item.detail }}</p>
            </div>
          </div>
        </PanelCard>

        <PanelCard class="space-y-4">
          <div>
            <p class="eyebrow">Supporting context</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Today’s agenda</h2>
          </div>
          <div class="space-y-3">
            <div v-for="item in dashboard.agenda" :key="item.id" class="rounded-soft bg-surface-low px-4 py-4">
              <p class="font-semibold text-ink">{{ item.title }}</p>
              <p class="mt-2 text-sm leading-6 text-muted">{{ item.description }}</p>
            </div>
          </div>
        </PanelCard>
      </div>
    </div>
  </div>
</template>
