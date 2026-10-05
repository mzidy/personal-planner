<script setup lang="ts">
import type { HabitPlanRecord, HabitPlansPayload } from '~~/shared/types/habit'
import { HABIT_WIZARD_STEPS, habitPlanTitle } from '~~/shared/utils/habit-wizard'

definePageMeta({
  middleware: 'protected'
})

const { data: payload, refresh } = await usePlannerFetch<HabitPlansPayload>(
  'habit-plans',
  '/api/habits/plans'
)

const TABS = [
  { label: 'Overview', to: '/goals' },
  { label: 'Habit guide', to: '/goals/guide' }
]

const route = useRoute()

const plans = computed(() => payload.value?.plans || [])

const steps = HABIT_WIZARD_STEPS
const stepIndex = ref(0)
const answers = reactive<Record<string, string>>({})
const editingId = ref<string | null>(null)
const saving = ref(false)
const errorMessage = ref('')
const wizardOpen = ref(false)

const currentStep = computed(() => steps[stepIndex.value]!)
const isFirst = computed(() => stepIndex.value === 0)
const isLast = computed(() => stepIndex.value === steps.length - 1)

/** A step counts as done once its required fields are filled. */
function stepComplete(index: number) {
  const step = steps[index]
  if (!step) {
    return false
  }
  return step.fields.filter(field => !field.optional).every(field => (answers[field.key] || '').trim())
}

const canAdvance = computed(() => stepComplete(stepIndex.value))
const completedCount = computed(() => steps.filter((_, index) => stepComplete(index)).length)
const draftTitle = computed(() => habitPlanTitle(answers))

function resetWizard() {
  for (const key of Object.keys(answers)) {
    delete answers[key]
  }
  stepIndex.value = 0
  editingId.value = null
  errorMessage.value = ''
}

function startNew() {
  resetWizard()
  wizardOpen.value = true
}

function editPlan(plan: HabitPlanRecord) {
  resetWizard()
  Object.assign(answers, plan.answers)
  editingId.value = plan.id
  wizardOpen.value = true
}

function goTo(index: number) {
  if (index >= 0 && index < steps.length) {
    stepIndex.value = index
  }
}

async function savePlan(status: 'draft' | 'active') {
  if (saving.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    if (editingId.value) {
      await $fetch(`/api/habits/plans/${editingId.value}`, {
        method: 'PATCH',
        body: { answers: { ...answers }, status }
      })
    } else {
      const created = await $fetch<HabitPlanRecord>('/api/habits/plans', {
        method: 'POST',
        body: { answers: { ...answers }, status }
      })
      editingId.value = created.id
    }
    await refresh()

    if (status === 'active') {
      wizardOpen.value = false
      resetWizard()
    }
  } catch {
    errorMessage.value = 'That habit could not be saved.'
  } finally {
    saving.value = false
  }
}

async function deletePlan(plan: HabitPlanRecord) {
  errorMessage.value = ''

  try {
    await $fetch(`/api/habits/plans/${plan.id}`, { method: 'DELETE' })
    if (editingId.value === plan.id) {
      wizardOpen.value = false
      resetWizard()
    }
    await refresh()
  } catch {
    errorMessage.value = 'Unable to delete that habit.'
  }
}

function fieldsFor(plan: HabitPlanRecord) {
  return steps.map(step => ({
    step,
    filled: step.fields
      .map(field => ({ field, value: plan.answers[field.key] || '' }))
      .filter(item => item.value)
  }))
}

function statusTone(status: string) {
  return status === 'active' ? 'teal' : 'mist'
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Habit guide"
      title="Design a habit that holds"
      subtitle="A step-by-step pass through the method in Atomic Habits — start from identity, then make the habit obvious, attractive, easy and satisfying."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Habits designed</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ plans.length }}</p>
          <p class="mt-2 text-sm text-muted">
            {{ plans.filter(plan => plan.status === 'active').length }} active
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

    <!-- Wizard -->
    <PanelCard v-if="wizardOpen" class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="eyebrow">{{ editingId ? 'Editing' : 'New habit' }}</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ draftTitle }}</h2>
          <p class="mt-1 text-sm text-muted">{{ completedCount }} of {{ steps.length }} steps complete</p>
        </div>
        <button
          type="button"
          class="text-xs font-semibold text-muted hover:text-ink"
          @click="wizardOpen = false"
        >
          Close
        </button>
      </div>

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
              : stepComplete(index)
                ? 'bg-teal text-ink'
                : 'bg-surface-low text-muted hover:bg-surface-high'
          "
          :aria-label="`Step ${index + 1}: ${step.title}`"
          :aria-current="index === stepIndex ? 'step' : undefined"
          @click="goTo(index)"
        >
          {{ index + 1 }}
        </button>
      </div>

      <div class="rounded-soft bg-surface-low px-5 py-5 md:px-7 md:py-7">
        <p class="eyebrow">{{ currentStep.lawLabel }}</p>
        <h3 class="mt-2 font-display text-2xl font-bold tracking-[-0.04em] md:text-3xl">
          {{ currentStep.title }}
        </h3>
        <p class="mt-3 max-w-2xl text-sm leading-7 text-muted">{{ currentStep.intro }}</p>

        <div class="mt-6 space-y-4">
          <label v-for="field in currentStep.fields" :key="field.key" class="block">
            <span class="eyebrow">
              {{ field.label }}<span v-if="field.optional" class="ml-1 normal-case text-muted">(optional)</span>
            </span>
            <textarea
              v-if="field.multiline"
              v-model="answers[field.key]"
              class="mt-2 min-h-[6rem] w-full rounded-2xl bg-surface px-4 py-3 leading-7 outline-none"
              :placeholder="field.placeholder"
            />
            <input
              v-else
              v-model="answers[field.key]"
              class="mt-2 w-full rounded-2xl bg-surface px-4 py-3 outline-none"
              type="text"
              :placeholder="field.placeholder"
            />
          </label>
        </div>

        <p class="mt-5 text-xs text-muted">Source: {{ currentStep.source }}</p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted">
          <span v-if="saving">Saving…</span>
          <span v-else-if="!canAdvance">Fill the required fields to continue</span>
          <span v-else>Step {{ stepIndex + 1 }} of {{ steps.length }}</span>
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
            :disabled="saving || !draftTitle"
            @click="savePlan('draft')"
          >
            Save draft
          </button>
          <button
            v-if="!isLast"
            type="button"
            class="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            :disabled="!canAdvance || saving"
            @click="goTo(stepIndex + 1)"
          >
            Next
          </button>
          <button
            v-else
            type="button"
            class="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            :disabled="!canAdvance || saving"
            @click="savePlan('active')"
          >
            Commit to it
          </button>
        </div>
      </div>
    </PanelCard>

    <PanelCard v-else class="space-y-4">
      <div>
        <p class="eyebrow">Start</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Design a new habit</h2>
        <p class="mt-1 max-w-2xl text-sm leading-7 text-muted">
          Six steps: who you want to become, the habit itself, then one step for each of the four laws
          of behaviour change.
        </p>
      </div>
      <button class="rounded-full bg-ink px-6 py-3 font-semibold text-white" @click="startNew">
        Start the guide
      </button>
    </PanelCard>

    <!-- Saved habits -->
    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">Your habits</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
          {{ plans.length }} designed
        </h2>
      </div>

      <p v-if="!plans.length" class="rounded-soft bg-surface-low px-4 py-8 text-center text-sm text-muted">
        Nothing yet — run the guide above to design your first habit.
      </p>

      <div v-else class="space-y-3">
        <article v-for="plan in plans" :key="plan.id" class="rounded-soft bg-surface-low px-5 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-ink">{{ plan.title }}</p>
                <StatusPill :label="plan.status" :tone="statusTone(plan.status)" />
              </div>
              <div class="mt-3 space-y-2">
                <div v-for="group in fieldsFor(plan)" :key="group.step.key">
                  <div v-if="group.filled.length" class="text-sm leading-6">
                    <p class="eyebrow">{{ group.step.lawLabel }}</p>
                    <p v-for="item in group.filled" :key="item.field.key" class="mt-1 text-muted">
                      <span class="font-semibold text-ink">{{ item.field.label }}:</span>
                      {{ item.value }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <button type="button" class="text-xs font-semibold text-ink" @click="editPlan(plan)">
                Edit
              </button>
              <button type="button" class="text-xs font-semibold text-rose-700" @click="deletePlan(plan)">
                Delete
              </button>
            </div>
          </div>
        </article>
      </div>
    </PanelCard>

    <p class="px-2 text-xs leading-5 text-muted">
      The steps follow the framework in <em>Atomic Habits</em> by James Clear. Prompts are written for this
      app; the book is the source for the method.
    </p>
  </div>
</template>
