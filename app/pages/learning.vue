<script setup lang="ts">
import type { LearningMessageRecord, LearningTopicRecord, LearningTopicSummary } from '~~/shared/types/learning'

definePageMeta({
  middleware: 'protected'
})

const { data: topics, refresh: refreshTopics } = await usePlannerFetch<LearningTopicSummary[]>(
  'learning-topics',
  '/api/learning/topics'
)

const activeTopic = ref<LearningTopicRecord | null>(null)
const messages = ref<LearningMessageRecord[]>([])
const threadLoading = ref(false)

const newTopicTitle = ref('')
const newTopicFocus = ref('')
const creatingTopic = ref(false)

const chatInput = ref('')
const chatBusy = ref(false)
const errorMessage = ref('')

const threadEl = ref<HTMLElement | null>(null)

function scrollThread() {
  nextTick(() => {
    if (threadEl.value) {
      threadEl.value.scrollTop = threadEl.value.scrollHeight
    }
  })
}

async function openTopic(topicId: string) {
  threadLoading.value = true
  errorMessage.value = ''

  try {
    const result = await $fetch<{ topic: LearningTopicRecord; messages: LearningMessageRecord[] }>(
      `/api/learning/topics/${topicId}`
    )
    activeTopic.value = result.topic
    messages.value = result.messages
    scrollThread()
  } catch {
    errorMessage.value = 'Unable to load this topic.'
  } finally {
    threadLoading.value = false
  }
}

async function createTopic() {
  const title = newTopicTitle.value.trim()
  if (!title || creatingTopic.value) {
    return
  }

  creatingTopic.value = true
  errorMessage.value = ''

  try {
    const record = await $fetch<LearningTopicRecord>('/api/learning/topics', {
      method: 'POST',
      body: { title, focus: newTopicFocus.value.trim() }
    })
    newTopicTitle.value = ''
    newTopicFocus.value = ''
    await refreshTopics()
    await openTopic(record.id)
  } catch {
    errorMessage.value = 'Unable to create the topic.'
  } finally {
    creatingTopic.value = false
  }
}

async function deleteTopic(topicId: string) {
  errorMessage.value = ''

  try {
    await $fetch(`/api/learning/topics/${topicId}`, { method: 'DELETE' })
    if (activeTopic.value?.id === topicId) {
      activeTopic.value = null
      messages.value = []
    }
    await refreshTopics()
  } catch {
    errorMessage.value = 'Unable to delete the topic.'
  }
}

async function sendMessage() {
  const text = chatInput.value.trim()
  if (!text || chatBusy.value || !activeTopic.value) {
    return
  }

  const topicId = activeTopic.value.id
  chatInput.value = ''
  chatBusy.value = true
  errorMessage.value = ''

  const optimistic: LearningMessageRecord = {
    id: `pending-${Date.now()}`,
    userId: '',
    topicId,
    role: 'user',
    content: text,
    createdAt: new Date().toISOString()
  }
  messages.value.push(optimistic)
  scrollThread()

  try {
    const result = await $fetch<{ userMessage: LearningMessageRecord; assistantMessage: LearningMessageRecord }>(
      `/api/learning/topics/${topicId}/chat`,
      { method: 'POST', body: { message: text } }
    )
    messages.value = messages.value.filter(item => item.id !== optimistic.id)
    messages.value.push(result.userMessage, result.assistantMessage)
    scrollThread()
    await refreshTopics()
  } catch (error) {
    messages.value = messages.value.filter(item => item.id !== optimistic.id)
    chatInput.value = text
    const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
    errorMessage.value =
      fetchError?.data?.statusMessage || fetchError?.data?.message || fetchError?.message || 'The tutor request failed.'
  } finally {
    chatBusy.value = false
  }
}

function formatDay(value: string | null) {
  if (!value) {
    return 'No sessions yet'
  }
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Executive AI"
      title="AI learning notebook"
      subtitle="A tutor with memory. Every topic keeps its full conversation history, so each session builds on the last."
    />

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <div class="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <div class="grid content-start gap-6">
        <PanelCard class="space-y-4">
          <div>
            <p class="eyebrow">New Topic</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Start learning something.</h2>
          </div>
          <form class="space-y-3" @submit.prevent="createTopic">
            <input
              v-model="newTopicTitle"
              class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="text"
              placeholder="Topic, e.g. Spanish, SQL, Roman history"
              required
            />
            <input
              v-model="newTopicFocus"
              class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="text"
              placeholder="Optional focus, e.g. conversational basics for travel"
            />
            <button
              class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
              :disabled="creatingTopic || !newTopicTitle.trim()"
            >
              Create topic
            </button>
          </form>
        </PanelCard>

        <PanelCard class="space-y-4">
          <div>
            <p class="eyebrow">Topics</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ topics?.length || 0 }} notebooks</h2>
          </div>
          <p v-if="!topics?.length" class="text-sm text-muted">No topics yet — create your first one above.</p>
          <div v-else class="space-y-3">
            <button
              v-for="topic in topics"
              :key="topic.id"
              class="w-full rounded-soft px-4 py-4 text-left transition-colors"
              :class="activeTopic?.id === topic.id ? 'bg-ink text-white' : 'bg-surface-low text-ink hover:bg-surface'"
              @click="openTopic(topic.id)"
            >
              <div class="flex items-center justify-between gap-3">
                <p class="font-semibold">{{ topic.title }}</p>
                <span
                  class="shrink-0 text-xs"
                  :class="activeTopic?.id === topic.id ? 'text-white/60' : 'text-muted'"
                >
                  {{ topic.messageCount }} msgs · {{ formatDay(topic.lastMessageAt) }}
                </span>
              </div>
              <p v-if="topic.focus" class="mt-1 text-sm" :class="activeTopic?.id === topic.id ? 'text-white/70' : 'text-muted'">
                {{ topic.focus }}
              </p>
            </button>
          </div>
        </PanelCard>
      </div>

      <PanelCard class="flex min-h-[36rem] flex-col space-y-4">
        <div v-if="!activeTopic" class="flex flex-1 items-center justify-center">
          <p class="max-w-sm text-center text-sm leading-6 text-muted">
            Pick a topic on the left — or create one — and start a tutoring session. The conversation is saved to your
            notebook.
          </p>
        </div>

        <template v-else>
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="eyebrow">Notebook</p>
              <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ activeTopic.title }}</h2>
              <p v-if="activeTopic.focus" class="mt-1 text-sm text-muted">{{ activeTopic.focus }}</p>
            </div>
            <button
              class="shrink-0 rounded-full bg-surface-low px-4 py-2 text-sm font-semibold text-rose-700"
              @click="deleteTopic(activeTopic.id)"
            >
              Delete
            </button>
          </div>

          <div ref="threadEl" class="flex-1 space-y-3 overflow-y-auto pr-1">
            <p v-if="threadLoading" class="text-sm text-muted">Loading notebook…</p>
            <p v-else-if="!messages.length" class="text-sm text-muted">
              No sessions yet. Ask your first question — try “Give me a beginner roadmap for this topic”.
            </p>
            <div
              v-for="message in messages"
              :key="message.id"
              class="max-w-2xl rounded-[1.75rem] px-5 py-4 text-sm leading-7"
              :class="message.role === 'user' ? 'ml-auto bg-ink text-white' : 'bg-surface-low text-ink'"
            >
              <p class="whitespace-pre-line">{{ message.content }}</p>
            </div>
            <p v-if="chatBusy" class="text-sm text-muted">Tutor is thinking…</p>
          </div>

          <form class="flex gap-3" @submit.prevent="sendMessage">
            <input
              v-model="chatInput"
              class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="text"
              placeholder="Ask the tutor anything about this topic…"
              :disabled="chatBusy"
            />
            <button
              class="shrink-0 rounded-full bg-ink px-6 py-3 font-semibold text-white disabled:opacity-50"
              :disabled="chatBusy || !chatInput.trim()"
            >
              Send
            </button>
          </form>
        </template>
      </PanelCard>
    </div>
  </div>
</template>
