<script setup lang="ts">
import { Check, Download } from 'lucide-vue-next'
import type { ClaudemyCourseView, ClaudemyLessonRecord } from '~~/shared/types/claudemy'
import { claudemyCardMarkdown } from '~~/shared/utils/claudemy-check'
import { CLAUDEMY_STAGES, claudemyStageIndex, isClaudemyWorking } from '~~/shared/utils/claudemy-stages'

definePageMeta({
  middleware: 'protected'
})

const route = useRoute()
const courseId = String(route.params.id)
const base = `/api/learning/claudemy`

const { data: view, error: loadError } = await usePlannerFetch<ClaudemyCourseView>(
  `claudemy-course-${courseId}`,
  `${base}/courses/${courseId}`
)

const course = computed(() => view.value?.course)
const lessons = computed(() => view.value?.lessons || [])
const pages = computed(() => view.value?.pages || [])

useHead(() => ({ title: course.value ? `${course.value.topic} · Claudemy` : 'Claudemy' }))

const running = ref(false)
const paused = ref(false)
const busyWaiting = ref(false)
const actionError = ref('')
const feedback = ref('')
const sending = ref(false)
let alive = true

function messageOf(error: unknown, fallback: string) {
  const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
  return fetchError?.data?.statusMessage || fetchError?.data?.message || fetchError?.message || fallback
}

/**
 * The pipeline moves one bounded step per request, so this page drives it:
 * it asks for the next step until the course reaches a stage that waits for
 * the learner, stops on an error, or is paused. Closing the page pauses the
 * course; opening it again carries on where it stopped.
 */
async function runSteps() {
  if (running.value || !alive) {
    return
  }
  running.value = true
  actionError.value = ''

  try {
    while (alive && !paused.value && course.value && isClaudemyWorking(course.value.stage) && !course.value.error) {
      const result = await $fetch<ClaudemyCourseView & { busy: boolean }>(`${base}/courses/${courseId}/step`, {
        method: 'POST'
      })
      view.value = { course: result.course, pages: result.pages, lessons: result.lessons }
      busyWaiting.value = result.busy
      if (result.busy) {
        // Another tab, or an earlier request that has not finished, holds the step.
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  } catch (error) {
    actionError.value = messageOf(error, 'The request for the next step failed.')
  } finally {
    running.value = false
    busyWaiting.value = false
  }
}

function retryStep() {
  if (view.value) {
    view.value = { ...view.value, course: { ...view.value.course, error: '' } }
  }
  paused.value = false
  runSteps()
}

function togglePause() {
  paused.value = !paused.value
  if (!paused.value) {
    runSteps()
  }
}

onMounted(() => runSteps())
onBeforeUnmount(() => {
  alive = false
})

// ---------------------------------------------------------------- progress

const stageIndex = computed(() => (course.value ? claudemyStageIndex(course.value.stage) : 0))
const saved = computed(() => pages.value.filter(page => page.status === 'saved'))
const failed = computed(() => pages.value.filter(page => page.status === 'failed'))
const noteCount = computed(() => pages.value.reduce((total, page) => total + page.noteCount, 0))
const written = computed(() => lessons.value.filter(lesson => lesson.status === 'written'))

const stageDetail = computed(() => {
  const current = course.value
  if (!current) {
    return ''
  }
  switch (current.stage) {
    case 'sourcing':
      return current.sourcingRound > 1
        ? `Looking for replacements, round ${current.sourcingRound} · ${saved.value.length} pages saved so far`
        : `${pages.value.length} pages listed so far for ${current.subtopics.length} sub-topics`
    case 'fetching':
      return `${saved.value.length} saved · ${failed.value.length} could not be read · ${pages.value.filter(page => page.status === 'pending').length} to go`
    case 'reading':
      return `${saved.value.filter(page => page.read).length} of ${saved.value.length} pages read · ${noteCount.value} notes`
    case 'clustering':
      return `${noteCount.value} notes from ${pages.value.filter(page => page.noteCount).length} sources`
    case 'planning':
      return `${current.themes.length} themes to plan from`
    case 'sample':
    case 'writing':
      return `${written.value.length} of ${lessons.value.length} lessons written`
    default:
      return ''
  }
})


// ---------------------------------------------------------------- lessons

const selectedNumber = ref<number | null>(null)

const selected = computed<ClaudemyLessonRecord | null>(() => {
  if (!lessons.value.length) {
    return null
  }
  const chosen = lessons.value.find(lesson => lesson.number === selectedNumber.value)
  if (chosen) {
    return chosen
  }
  // Default to the first written lesson not heard yet; skips are fine, so this is only a starting point.
  return written.value.find(lesson => !lesson.heardAt) || written.value[0] || lessons.value[0] || null
})

watch(
  () => course.value?.stage,
  stage => {
    if (stage === 'feedback') {
      selectedNumber.value = 1
    }
  }
)

const lessonsByArc = computed(() =>
  (course.value?.arcs || []).map((arc, index) => ({
    arc,
    index,
    lessons: lessons.value.filter(lesson => lesson.arc === index)
  }))
)

// useFetch data is a shallow ref, so changes replace the view rather than mutate it.
function replaceLesson(updated: ClaudemyLessonRecord) {
  if (!view.value) {
    return
  }
  view.value = { ...view.value, lessons: view.value.lessons.map(lesson => (lesson.id === updated.id ? updated : lesson)) }
}

async function setProgress(lesson: ClaudemyLessonRecord, patch: { heard?: boolean; tried?: boolean; ruleKept?: boolean }) {
  try {
    replaceLesson(await $fetch<ClaudemyLessonRecord>(`${base}/lessons/${lesson.id}`, { method: 'PATCH', body: patch }))
  } catch (error) {
    actionError.value = messageOf(error, 'Unable to save that.')
  }
}

async function approveSample() {
  sending.value = true
  try {
    view.value = await $fetch<ClaudemyCourseView>(`${base}/courses/${courseId}/approve`, {
      method: 'POST',
      body: { feedback: feedback.value }
    })
    feedback.value = ''
    runSteps()
  } catch (error) {
    actionError.value = messageOf(error, 'Unable to approve the sample lesson.')
  } finally {
    sending.value = false
  }
}

async function rewriteSample() {
  sending.value = true
  try {
    view.value = await $fetch<ClaudemyCourseView>(`${base}/courses/${courseId}/rewrite-sample`, {
      method: 'POST',
      body: { feedback: feedback.value }
    })
    runSteps()
  } catch (error) {
    actionError.value = messageOf(error, 'Unable to rewrite the sample lesson.')
  } finally {
    sending.value = false
  }
}

async function retryLesson(lesson: ClaudemyLessonRecord) {
  try {
    view.value = await $fetch<ClaudemyCourseView>(`${base}/lessons/${lesson.id}/retry`, { method: 'POST' })
    runSteps()
  } catch (error) {
    actionError.value = messageOf(error, 'Unable to retry that lesson.')
  }
}

async function deleteCourse() {
  if (!course.value || !window.confirm(`Delete the course "${course.value.topic}" with its lessons and notes?`)) {
    return
  }
  try {
    await $fetch(`${base}/courses/${courseId}`, { method: 'DELETE' })
    await navigateTo('/learning/claudemy')
  } catch (error) {
    actionError.value = messageOf(error, 'Unable to delete the course.')
  }
}

// ---------------------------------------------------------------- playbook

const effort = computed(() => ({
  heard: lessons.value.filter(lesson => lesson.heardAt).length,
  tried: lessons.value.filter(lesson => lesson.triedAt).length,
  kept: lessons.value.filter(lesson => lesson.ruleKept).length
}))

function counted(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

const effortLine = computed(
  () =>
    `${counted(effort.value.heard, 'lesson heard', 'lessons heard')} · ${counted(effort.value.tried, 'thing tried', 'things tried')} · ${counted(effort.value.kept, 'rule kept', 'rules kept')}`
)

const keptRules = computed(() => lessons.value.filter(lesson => lesson.ruleKept && lesson.card))

function slug() {
  return (course.value?.topic || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function downloadCards() {
  const cards = written.value.map(lesson => claudemyCardMarkdown(lesson)).join('\n\n---\n\n')
  download(`${slug()}-cards.md`, `# ${course.value?.topic}\n\n${cards}\n`)
}

function downloadPlaybook() {
  const lines = [
    `# Playbook: ${course.value?.topic}`,
    '',
    `Effort so far: ${effortLine.value}`,
    '',
    '## Rules I keep',
    ...(keptRules.value.length
      ? keptRules.value.map(lesson => `- ${lesson.card!.rule} (lesson ${lesson.number}, ${lesson.handle})`)
      : ['- None marked yet.']),
    '',
    '## Every rule in the course',
    ...written.value.map(lesson => `- ${lesson.card!.rule} (lesson ${lesson.number}, ${lesson.handle})`)
  ]
  download(`${slug()}-playbook.md`, `${lines.join('\n')}\n`)
}

function pageBySeq(seq: number) {
  return pages.value.find(page => page.seq === seq)
}
</script>

<template>
  <div v-if="loadError || !course" class="space-y-4">
    <AppPageHero eyebrow="Claudemy" title="Course not found." />
    <NuxtLink to="/learning/claudemy" class="text-sm font-semibold text-accent">Back to Claudemy</NuxtLink>
  </div>

  <div v-else class="space-y-8">
    <!-- Usage stays in view while the course is being built: it moves after every step. -->
    <div class="pointer-events-none sticky top-24 z-20 -mb-4 flex justify-end">
      <ClaudemyUsageMeter
        class="pointer-events-auto"
        :input-tokens="course.inputTokens"
        :output-tokens="course.outputTokens"
        :web-searches="course.webSearches"
        :running="running && !course.error"
      />
    </div>

    <AppPageHero
      :eyebrow="`Claudemy · ${course.level}${course.person ? ` · from ${course.person}` : ''}`"
      :title="course.topic"
      :subtitle="
        course.stage === 'done'
          ? `${written.length} lessons, about two minutes each. Skips cost nothing; every lesson stands on its own.`
          : course.stage === 'feedback'
            ? 'Lesson 1 is ready. Listen to it, then approve it or say what to change; the rest are written after that.'
            : 'Being researched and written. Keep this page open; closing it pauses the course, and it carries on when you come back.'
      "
    >
      <template #aside>
        <div class="flex flex-col items-start gap-2 text-sm md:items-end">
          <div class="flex gap-2">
            <NuxtLink to="/learning/claudemy" class="rounded-full bg-surface-low px-4 py-2 font-semibold text-ink">
              All courses
            </NuxtLink>
            <button class="rounded-full bg-surface-low px-4 py-2 font-semibold text-rose-700" @click="deleteCourse">
              Delete
            </button>
          </div>
        </div>
      </template>
    </AppPageHero>

    <p v-if="actionError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ actionError }}</p>

    <!-- Pipeline progress, until the course is ready -->
    <PanelCard v-if="course.stage !== 'done'" class="space-y-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="eyebrow">Step {{ stageIndex + 1 }} of {{ CLAUDEMY_STAGES.length }}</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
            {{ CLAUDEMY_STAGES[stageIndex]?.working }}<span v-if="running && !course.error">…</span>
          </h2>
          <p v-if="stageDetail" class="mt-1 text-sm text-muted">{{ stageDetail }}</p>
          <p v-if="busyWaiting" class="mt-1 text-sm text-muted">Another open tab is running this step; waiting for it.</p>
        </div>
        <button
          v-if="isClaudemyWorking(course.stage) && !course.error"
          class="rounded-full bg-surface-low px-4 py-2 text-sm font-semibold text-ink"
          @click="togglePause"
        >
          {{ paused ? 'Resume' : running ? 'Pause after this step' : 'Resume' }}
        </button>
      </div>

      <ol class="grid gap-2 sm:grid-cols-5">
        <li
          v-for="(entry, index) in CLAUDEMY_STAGES"
          :key="entry.stage"
          class="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
          :class="
            index < stageIndex
              ? 'bg-teal/15 text-accent'
              : index === stageIndex
                ? 'bg-ink text-white'
                : 'bg-surface-low text-muted'
          "
        >
          <Check v-if="index < stageIndex" class="h-3.5 w-3.5 shrink-0" />
          <span v-else class="w-3.5 shrink-0 text-center">{{ index + 1 }}</span>
          {{ entry.label }}
        </li>
      </ol>

      <div v-if="course.error" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <p class="text-sm text-rose-700">{{ course.error }}</p>
        <button class="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white" @click="retryStep">
          Retry this step
        </button>
      </div>
    </PanelCard>

    <!-- The sample lesson waits for the learner -->
    <PanelCard v-if="course.stage === 'feedback'" tone="muted" class="space-y-4">
      <div>
        <p class="eyebrow">Lesson 1 is ready</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Listen first, then shape the rest.</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Fixing the format on one lesson is cheap; fixing it on twelve is not. Say what to change (length, tone, more
          stories, simpler tasks), and every later lesson copies the approved one.
        </p>
      </div>
      <textarea
        v-model="feedback"
        class="min-h-[6rem] w-full rounded-2xl bg-surface px-4 py-3 text-sm outline-none"
        maxlength="2000"
        placeholder="Optional: what to keep, what to change"
      />
      <div class="flex flex-wrap gap-3">
        <button
          class="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="sending"
          @click="approveSample"
        >
          Approve and write the rest
        </button>
        <button
          class="rounded-full bg-surface px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
          :disabled="sending || !feedback.trim()"
          @click="rewriteSample"
        >
          Rewrite lesson 1 with this feedback
        </button>
      </div>
    </PanelCard>

    <!-- Lessons -->
    <div v-if="lessons.length" class="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <div class="grid content-start gap-6">
        <PanelCard v-for="group in lessonsByArc" :key="group.index" class="space-y-3">
          <div>
            <p class="eyebrow">Arc {{ group.index + 1 }}</p>
            <h2 class="mt-2 font-display text-xl font-bold tracking-[-0.04em]">{{ group.arc.title }}</h2>
            <p class="mt-1 text-sm text-muted">{{ group.arc.why }}</p>
          </div>
          <button
            v-for="lesson in group.lessons"
            :key="lesson.id"
            class="w-full rounded-soft px-4 py-3 text-left transition-colors"
            :class="selected?.id === lesson.id ? 'bg-ink text-white' : 'bg-surface-low text-ink hover:bg-surface'"
            @click="selectedNumber = lesson.number"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="font-semibold">{{ lesson.number }}. {{ lesson.handle }}</p>
              <span class="shrink-0 text-xs" :class="selected?.id === lesson.id ? 'text-white/70' : 'text-muted'">
                <template v-if="lesson.status === 'written'">
                  {{ lesson.heardAt ? 'heard' : 'new' }}{{ lesson.triedAt ? ' · tried' : '' }}{{ lesson.ruleKept ? ' · rule kept' : '' }}
                </template>
                <template v-else-if="lesson.status === 'failed'">didn't pass the checker</template>
                <template v-else>not written yet</template>
              </span>
            </div>
            <p class="mt-1 text-xs" :class="selected?.id === lesson.id ? 'text-white/60' : 'text-muted'">
              {{ lesson.plan.agree }} of {{ lesson.plan.of }} sources agree
            </p>
          </button>
          <p class="text-xs text-muted">Finish: {{ group.arc.finish }}</p>
        </PanelCard>
      </div>

      <PanelCard v-if="selected" class="space-y-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="eyebrow">Lesson {{ selected.number }} of {{ lessons.length }}</p>
            <h2 class="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">{{ selected.handle }}</h2>
          </div>
          <div v-if="selected.status === 'written'" class="flex flex-wrap gap-2 text-xs font-semibold">
            <button
              class="rounded-full px-3 py-1.5"
              :class="selected.heardAt ? 'bg-ink text-white' : 'bg-surface-low text-muted'"
              @click="setProgress(selected, { heard: !selected.heardAt })"
            >
              Heard
            </button>
            <button
              class="rounded-full px-3 py-1.5"
              :class="selected.triedAt ? 'bg-ink text-white' : 'bg-surface-low text-muted'"
              @click="setProgress(selected, { tried: !selected.triedAt })"
            >
              Tried it
            </button>
            <button
              class="rounded-full px-3 py-1.5"
              :class="selected.ruleKept ? 'bg-ink text-white' : 'bg-surface-low text-muted'"
              @click="setProgress(selected, { ruleKept: !selected.ruleKept })"
            >
              Keep the rule
            </button>
          </div>
        </div>

        <template v-if="selected.status === 'written' && selected.script && selected.card">
          <ClaudemyLessonPlayer
            :script="selected.script"
            :words="selected.words"
            @finished="!selected.heardAt && setProgress(selected, { heard: true })"
          />
          <ClaudemyLessonCard
            :card="selected.card"
            :next-number="selected.number < lessons.length ? selected.number + 1 : null"
          />
        </template>

        <template v-else>
          <div v-if="selected.status === 'failed'" class="space-y-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p class="font-semibold">This lesson failed the checker {{ selected.attempts }} times, so it was set aside:</p>
            <ul class="list-disc space-y-1 pl-5">
              <li v-for="problem in selected.problems" :key="problem">{{ problem }}</li>
            </ul>
            <button class="rounded-full bg-ink px-4 py-2 font-semibold text-white" @click="retryLesson(selected)">
              Try writing it again
            </button>
          </div>
          <div class="space-y-3 text-sm leading-6">
            <p class="eyebrow">From the plan</p>
            <p>{{ selected.plan.idea }}</p>
            <p class="text-muted">{{ selected.plan.whyItMatters }}</p>
            <p>
              <span class="font-semibold">Try it</span> · {{ selected.plan.tryIt.energy }} · {{ selected.plan.tryIt.minutes }} min:
              {{ selected.plan.tryIt.what }}
            </p>
            <p><span class="font-semibold">Rule to keep:</span> {{ selected.plan.rule }}</p>
            <p v-if="selected.status === 'planned'" class="text-muted">
              Not written yet{{ selected.attempts ? ` (attempt ${selected.attempts} was sent back by the checker)` : '' }}.
            </p>
          </div>
        </template>
      </PanelCard>
    </div>

    <!-- Playbook, splits, gaps -->
    <div v-if="written.length" class="grid gap-6 xl:grid-cols-2">
      <PanelCard class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="eyebrow">Playbook</p>
            <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">The rules you keep.</h2>
          </div>
          <div class="flex gap-2">
            <button class="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-2 text-xs font-semibold" @click="downloadPlaybook">
              <Download class="h-3.5 w-3.5" /> Playbook
            </button>
            <button class="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-2 text-xs font-semibold" @click="downloadCards">
              <Download class="h-3.5 w-3.5" /> All cards
            </button>
          </div>
        </div>
        <p class="text-sm text-muted">{{ effortLine }}</p>
        <p v-if="!keptRules.length" class="text-sm text-muted">
          Mark “Keep the rule” on a lesson and its rule lands here. That list is how the learning outlives the course.
        </p>
        <ul v-else class="space-y-2 text-sm">
          <li v-for="lesson in keptRules" :key="lesson.id" class="rounded-soft bg-surface-low px-4 py-3">
            <p class="font-semibold">{{ lesson.card!.rule }}</p>
            <p class="mt-1 text-xs text-muted">Lesson {{ lesson.number }}, {{ lesson.handle }}</p>
          </li>
        </ul>
      </PanelCard>

      <PanelCard v-if="course.splits.length || course.gaps.length" class="space-y-4">
        <div>
          <p class="eyebrow">Splits</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Where good sources disagree.</h2>
          <p class="mt-1 text-sm text-muted">These are decisions, not lessons.</p>
        </div>
        <div v-for="split in course.splits" :key="split.question" class="space-y-2 rounded-soft bg-surface-low px-4 py-3 text-sm">
          <p class="font-semibold">{{ split.question }}</p>
          <ul class="space-y-1">
            <li v-for="side in split.sides" :key="side.position">
              {{ side.position }}
              <span class="text-xs text-muted">
                <template v-for="seq in side.sources" :key="seq">
                  <a
                    v-if="pageBySeq(seq)"
                    :href="pageBySeq(seq)!.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="ml-1 hover:text-ink"
                    :title="pageBySeq(seq)!.title"
                  >S{{ seq }}</a>
                </template>
              </span>
            </li>
          </ul>
          <p class="text-muted">How to decide: {{ split.howToDecide }}</p>
        </div>
        <div v-if="course.gaps.length" class="text-sm">
          <p class="eyebrow">Coverage gaps</p>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li v-for="gap in course.gaps" :key="gap">{{ gap }}</li>
          </ul>
        </div>
      </PanelCard>
    </div>

    <!-- What the course read -->
    <PanelCard v-if="course.subtopics.length" class="space-y-4">
      <details>
        <summary class="cursor-pointer">
          <span class="eyebrow">Reading list</span>
          <span class="ml-2 text-sm text-muted">
            {{ saved.length }} pages read · {{ failed.length }} could not be read · {{ course.subtopics.length }} sub-topics
          </span>
        </summary>
        <div class="mt-4 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <ul class="space-y-1 text-sm">
            <li v-for="topic in course.subtopics" :key="topic.id">
              <span class="font-semibold">{{ topic.id }}</span> {{ topic.name }}
            </li>
          </ul>
          <ul class="space-y-2 text-sm">
            <li v-for="page in pages" :key="page.id" class="flex gap-3">
              <span class="w-9 shrink-0 text-xs font-semibold text-muted">S{{ page.seq }}</span>
              <div class="min-w-0">
                <a
                  :href="page.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="break-words font-medium hover:underline"
                  :class="page.status === 'failed' ? 'text-muted line-through' : 'text-ink'"
                >
                  {{ page.title || page.url }}
                </a>
                <p class="text-xs text-muted">
                  {{ page.kind }} · {{ page.subtopics.join(', ') }}
                  <template v-if="page.status === 'saved'"> · {{ page.words }} words · {{ counted(page.noteCount, 'note', 'notes') }}</template>
                  <template v-if="page.status === 'failed'"> · not saved: {{ page.failReason }}</template>
                  <template v-if="page.skipReason"> · skipped: {{ page.skipReason }}</template>
                </p>
              </div>
            </li>
          </ul>
        </div>
      </details>
    </PanelCard>
  </div>
</template>
