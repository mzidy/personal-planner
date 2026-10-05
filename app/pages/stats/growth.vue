<script setup lang="ts">
import type { GrowthOverview } from '~~/shared/types/growth'

definePageMeta({
  middleware: 'protected'
})

const { data: overview, refresh } = await usePlannerFetch<GrowthOverview>(
  'growth-overview',
  '/api/growth/overview'
)

const TABS = [
  { label: 'Overview', to: '/stats' },
  { label: 'Personal Growth', to: '/stats/growth' }
]

const route = useRoute()

const steps = computed(() => overview.value?.steps || [])
const stepIndex = ref(0)
const draft = ref('')
const saving = ref(false)
const errorMessage = ref('')

const currentStep = computed(() => steps.value[stepIndex.value] || null)
const isFirst = computed(() => stepIndex.value === 0)
const isLast = computed(() => stepIndex.value >= steps.value.length - 1)
const isDirty = computed(() => draft.value.trim() !== (currentStep.value?.answer || ''))

/** Open on the first unanswered prompt so you resume where you stopped. */
onMounted(() => {
  const next = steps.value.findIndex(step => !step.answer)
  stepIndex.value = next === -1 ? 0 : next
  draft.value = currentStep.value?.answer || ''
})

// Loading a different step replaces the draft with whatever is stored for it.
watch([stepIndex, steps], () => {
  draft.value = currentStep.value?.answer || ''
})

async function save() {
  const step = currentStep.value
  if (!step || saving.value || !isDirty.value) {
    return true
  }

  saving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/growth/answers', {
      method: 'POST',
      body: { stepKey: step.key, answer: draft.value }
    })
    await refresh()
    return true
  } catch {
    errorMessage.value = 'That answer could not be saved.'
    return false
  } finally {
    saving.value = false
  }
}

/** Never navigate away from unsaved text — save first, and stay put if it fails. */
async function goTo(index: number) {
  if (index < 0 || index >= steps.value.length || index === stepIndex.value) {
    return
  }
  if (!(await save())) {
    return
  }
  stepIndex.value = index
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''
}
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <AppPageHero
      eyebrow="Personal Growth"
      title="Questions worth sitting with"
      subtitle="One at a time. Answers save as you move between steps, and you can change them whenever."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Answered</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">
            {{ overview.answeredCount }}<span class="text-2xl text-muted">/{{ overview.totalCount }}</span>
          </p>
        </PanelCard>
      </template>
    </AppPageHero>

    <div class="flex flex-wrap items-center gap-2">
      <NuxtLink
        v-for="tab in TABS"
        :key="tab.to"
        :to="tab.to"
        class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
        :class="route.path === tab.to ? 'bg-ink text-white' : 'bg-surface-low text-ink hover:bg-surface'"
      >
        {{ tab.label }}
      </NuxtLink>
    </div>

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <PanelCard v-if="currentStep" class="space-y-6">
      <!-- Step rail -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="(step, index) in steps"
          :key="step.key"
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors"
          :class="
            index === stepIndex
              ? 'bg-ink text-white'
              : step.answer
                ? 'bg-teal text-ink'
                : 'bg-surface-low text-muted hover:bg-surface-high'
          "
          :aria-label="`Step ${index + 1}: ${step.question}`"
          :aria-current="index === stepIndex ? 'step' : undefined"
          @click="goTo(index)"
        >
          {{ index + 1 }}
        </button>
        <span class="ml-2 text-sm text-muted">Step {{ stepIndex + 1 }} of {{ steps.length }}</span>
      </div>

      <!-- The question, given the room it deserves -->
      <div class="rounded-soft bg-accent px-6 py-10 text-center md:px-10 md:py-14">
        <h2 class="font-display text-3xl font-bold leading-tight tracking-[-0.04em] text-white md:text-5xl">
          {{ currentStep.question }}
        </h2>
        <p class="mt-4 text-sm text-white/65 md:text-base">{{ currentStep.hint }}</p>
      </div>

      <div class="space-y-3">
        <label class="block">
          <span class="eyebrow">Your answer</span>
          <textarea
            v-model="draft"
            class="mt-2 min-h-[11rem] w-full rounded-2xl bg-surface-low px-4 py-3 leading-7 outline-none"
            placeholder="Write it in your own words. There is no right answer."
          />
        </label>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-muted">
            <span v-if="saving">Saving…</span>
            <span v-else-if="isDirty">Unsaved changes</span>
            <span v-else-if="currentStep.answeredAt">Saved {{ formatDate(currentStep.answeredAt) }}</span>
            <span v-else>Not answered yet</span>
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-full bg-surface-low px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
              :disabled="isFirst || saving"
              @click="goTo(stepIndex - 1)"
            >
              Back
            </button>
            <button
              type="button"
              class="rounded-full bg-surface-low px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
              :disabled="saving || !isDirty"
              @click="save()"
            >
              Save
            </button>
            <button
              type="button"
              class="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              :disabled="isLast || saving"
              @click="goTo(stepIndex + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </PanelCard>

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">Your answers</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
          {{ overview.answeredCount }} of {{ overview.totalCount }} answered
        </h2>
      </div>

      <div class="space-y-3">
        <article
          v-for="(step, index) in steps"
          :key="step.key"
          class="rounded-soft bg-surface-low px-5 py-4"
        >
          <button type="button" class="w-full text-left" @click="goTo(index)">
            <p class="font-semibold text-ink">{{ index + 1 }}. {{ step.question }}</p>
            <p v-if="step.answer" class="mt-2 whitespace-pre-line text-sm leading-7 text-muted">
              {{ step.answer }}
            </p>
            <p v-else class="mt-2 text-sm italic text-muted">Not answered yet — tap to write one.</p>
          </button>
        </article>
      </div>
    </PanelCard>
  </div>
</template>
