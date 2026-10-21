<script setup lang="ts">
import type { ClaudemyCourseRecord, ClaudemyCourseSummary, ClaudemyLevel } from '~~/shared/types/claudemy'
import { CLAUDEMY_STAGES, claudemyStageIndex, isClaudemyWorking } from '~~/shared/utils/claudemy-stages'

definePageMeta({
  middleware: 'protected'
})

useHead({ title: 'Claudemy' })

const { data: courses } = await usePlannerFetch<ClaudemyCourseSummary[]>('claudemy-courses', '/api/learning/claudemy/courses')

/** What every course together has used so far. */
const totals = computed(() =>
  (courses.value || []).reduce(
    (sum, course) => ({
      inputTokens: sum.inputTokens + course.inputTokens,
      outputTokens: sum.outputTokens + course.outputTokens,
      webSearches: sum.webSearches + course.webSearches
    }),
    { inputTokens: 0, outputTokens: 0, webSearches: 0 }
  )
)

const form = reactive({
  topic: '',
  level: 'beginner' as ClaudemyLevel,
  lessonCount: 12,
  person: ''
})
const creating = ref(false)
const errorMessage = ref('')

async function createCourse() {
  if (!form.topic.trim() || creating.value) {
    return
  }
  creating.value = true
  errorMessage.value = ''

  try {
    const course = await $fetch<ClaudemyCourseRecord>('/api/learning/claudemy/courses', {
      method: 'POST',
      body: { ...form, topic: form.topic.trim(), person: form.person.trim() }
    })
    await navigateTo(`/learning/claudemy/${course.id}`)
  } catch (error) {
    const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
    errorMessage.value =
      fetchError?.data?.statusMessage || fetchError?.data?.message || fetchError?.message || 'Unable to start the course.'
  } finally {
    creating.value = false
  }
}

function stageLabel(course: ClaudemyCourseSummary) {
  if (course.error) {
    return 'Stopped'
  }
  if (course.stage === 'done') {
    return 'Ready'
  }
  const index = claudemyStageIndex(course.stage)
  return `${index + 1} of ${CLAUDEMY_STAGES.length} · ${CLAUDEMY_STAGES[index]?.label}`
}

function stageTone(course: ClaudemyCourseSummary) {
  if (course.error) {
    return 'danger'
  }
  if (course.stage === 'done') {
    return 'teal'
  }
  return isClaudemyWorking(course.stage) ? 'mist' : 'ink'
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="space-y-8">
    <div class="pointer-events-none sticky top-24 z-20 -mb-4 flex justify-end">
      <ClaudemyUsageMeter
        class="pointer-events-auto"
        label="All courses"
        :input-tokens="totals.inputTokens"
        :output-tokens="totals.outputTokens"
        :web-searches="totals.webSearches"
      />
    </div>

    <AppPageHero
      eyebrow="AI Learning · Claudemy"
      title="Any topic, as a short audio course."
      subtitle="Claudemy researches a topic on the web, works out what most good sources agree on and where they split, then writes two-minute lessons for two hosts, each with a one-screen card and one small thing to try."
    />

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <PanelCard class="space-y-5">
        <div>
          <p class="eyebrow">New Course</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">What do you want to learn?</h2>
        </div>

        <form class="space-y-3" @submit.prevent="createCourse">
          <input
            v-model="form.topic"
            class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="text"
            maxlength="160"
            placeholder="Topic, e.g. negotiation, sourdough baking, technical interviewing"
            required
          />
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1">
              <span class="eyebrow">Level</span>
              <select v-model="form.level" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Knows the basics</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label class="space-y-1">
              <span class="eyebrow">Lessons</span>
              <input
                v-model.number="form.lessonCount"
                class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
                type="number"
                min="4"
                max="20"
              />
            </label>
          </div>
          <label class="block space-y-1">
            <span class="eyebrow">From one person's work (optional)</span>
            <input
              v-model="form.person"
              class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="text"
              maxlength="120"
              placeholder="e.g. Chris Voss. Leave empty to research the topic broadly."
            />
          </label>
          <button
            class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
            :disabled="creating || form.topic.trim().length < 2"
          >
            {{ creating ? 'Starting…' : 'Build the course' }}
          </button>
        </form>

        <div class="space-y-2 rounded-soft bg-surface-low px-5 py-4 text-sm leading-6 text-muted">
          <p class="font-semibold text-ink">How it works</p>
          <p>
            It maps the topic, reads 20 to 40 pages (no more than three from any one site, including some that
            disagree), clusters the notes into themes with how many sources agree, and plans the lessons. Lesson 1
            comes first; the rest are written once you have listened to it and said what to change.
          </p>
          <p>
            Every link on a card is a page the course actually read. Building one takes 15 to 30 minutes with this page
            open, and costs roughly $3 to $6 in Claude API usage. Lessons play with your browser's voices.
          </p>
        </div>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Courses</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ courses?.length || 0 }} {{ courses?.length === 1 ? 'course' : 'courses' }}</h2>
        </div>
        <p v-if="!courses?.length" class="text-sm text-muted">No courses yet. Start one on the left.</p>
        <div v-else class="space-y-3">
          <NuxtLink
            v-for="course in courses"
            :key="course.id"
            :to="`/learning/claudemy/${course.id}`"
            class="block rounded-soft bg-surface-low px-5 py-4 transition-colors hover:bg-surface"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold">{{ course.topic }}</p>
                <p class="mt-1 text-sm text-muted">
                  {{ course.level }}<template v-if="course.person"> · from {{ course.person }}</template> ·
                  {{ course.lessonsWritten }} of {{ course.lessonCount }} lessons written · {{ course.lessonsHeard }} heard
                </p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-2">
                <StatusPill :label="stageLabel(course)" :tone="stageTone(course)" />
                <span class="text-xs text-muted">{{ formatDay(course.updatedAt) }}</span>
              </div>
            </div>
          </NuxtLink>
        </div>
      </PanelCard>
    </div>
  </div>
</template>
