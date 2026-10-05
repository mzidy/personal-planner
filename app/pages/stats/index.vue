<script setup lang="ts">
import type { StatsOverview } from '~~/shared/types/stats'
import StatsWeightTrendChart from '~/components/stats/WeightTrendChart.vue'

definePageMeta({
  middleware: 'protected'
})

const { data: overview, refresh } = await usePlannerFetch<StatsOverview>('stats-overview', '/api/stats/overview')

const TABS = [
  { label: 'Overview', to: '/stats' },
  { label: 'Personal Growth', to: '/stats/growth' }
]

const route = useRoute()

const weightInput = ref('')
const bodyFatInput = ref('')
const notesInput = ref('')
const savingWeighIn = ref(false)

const heightInput = ref('')
const targetInput = ref('')
const savingProfile = ref(false)

const errorMessage = ref('')

watch(
  overview,
  value => {
    heightInput.value = value?.profile?.heightCm != null ? String(value.profile.heightCm) : ''
    targetInput.value = value?.profile?.targetWeightKg != null ? String(value.profile.targetWeightKg) : ''
  },
  { immediate: true }
)

async function saveProfile() {
  if (savingProfile.value) {
    return
  }

  savingProfile.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/stats/profile', {
      method: 'POST',
      body: {
        heightCm: heightInput.value.trim() ? Number(heightInput.value) : null,
        targetWeightKg: targetInput.value.trim() ? Number(targetInput.value) : null
      }
    })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to save your profile. Check the values and try again.'
  } finally {
    savingProfile.value = false
  }
}

async function saveWeighIn() {
  const weight = Number(weightInput.value)
  if (!weight || savingWeighIn.value) {
    return
  }

  savingWeighIn.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/stats/weigh-ins', {
      method: 'POST',
      body: {
        weightKg: weight,
        bodyFatPercent: bodyFatInput.value.trim() ? Number(bodyFatInput.value) : null,
        notes: notesInput.value.trim()
      }
    })
    weightInput.value = ''
    bodyFatInput.value = ''
    notesInput.value = ''
    await refresh()
  } catch {
    errorMessage.value = 'Unable to save this weigh-in. Weight must be between 25 and 400 kg.'
  } finally {
    savingWeighIn.value = false
  }
}

async function deleteWeighIn(id: string) {
  errorMessage.value = ''

  try {
    await $fetch(`/api/stats/weigh-ins/${id}`, { method: 'DELETE' })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to delete that weigh-in.'
  }
}

function formatDelta(value: number | null) {
  if (value === null) {
    return '—'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)} kg`
}

function deltaTone(value: number | null) {
  if (value === null || value === 0) {
    return 'text-muted'
  }
  return value < 0 ? 'text-emerald-700' : 'text-rose-700'
}

function formatWeek(weekKey: string) {
  return new Date(weekKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <AppPageHero
      eyebrow="Body Metrics"
      title="Personal stats"
      subtitle="One weigh-in a week is all it takes. Height and target stay fixed; the trend does the talking."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Current weight</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">
            {{ overview.currentWeightKg !== null ? `${overview.currentWeightKg.toFixed(1)} kg` : '—' }}
          </p>
          <p class="mt-2 text-sm" :class="deltaTone(overview.weekChangeKg)">
            {{ formatDelta(overview.weekChangeKg) }} vs last entry
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

    <div class="grid gap-4 md:grid-cols-4">
      <PanelCard>
        <p class="eyebrow">12-week change</p>
        <p class="mt-2 text-2xl font-semibold" :class="deltaTone(overview.twelveWeekChangeKg)">
          {{ formatDelta(overview.twelveWeekChangeKg) }}
        </p>
      </PanelCard>
      <PanelCard>
        <p class="eyebrow">BMI</p>
        <p class="mt-2 text-2xl font-semibold">{{ overview.bmi !== null ? overview.bmi.toFixed(1) : '—' }}</p>
        <p class="mt-1 text-sm text-muted">{{ overview.bmiLabel || 'Add your height' }}</p>
      </PanelCard>
      <PanelCard>
        <p class="eyebrow">To target</p>
        <p class="mt-2 text-2xl font-semibold">
          {{ overview.targetDeltaKg !== null ? formatDelta(overview.targetDeltaKg) : '—' }}
        </p>
        <p class="mt-1 text-sm text-muted">
          {{ overview.profile?.targetWeightKg != null ? `Target ${overview.profile.targetWeightKg} kg` : 'Set a target' }}
        </p>
      </PanelCard>
      <PanelCard>
        <p class="eyebrow">Weigh-in streak</p>
        <p class="mt-2 text-2xl font-semibold">{{ overview.streakWeeks }} wk</p>
        <p class="mt-1 text-sm" :class="overview.currentWeekLogged ? 'text-emerald-700' : 'text-muted'">
          {{ overview.currentWeekLogged ? 'This week logged' : 'This week pending' }}
        </p>
      </PanelCard>
    </div>

    <PanelCard class="space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="eyebrow">Trend</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Last 12 weeks</h2>
        </div>
        <div class="flex items-center gap-4 text-sm text-muted">
          <span class="flex items-center gap-2"><span class="h-2 w-6 rounded-full bg-ink"></span>Weight</span>
          <span v-if="overview.profile?.targetWeightKg != null" class="flex items-center gap-2">
            <span class="h-0.5 w-6 rounded-full bg-teal"></span>Target
          </span>
        </div>
      </div>

      <StatsWeightTrendChart :series="overview.series" :target-weight-kg="overview.profile?.targetWeightKg">
        <template #empty>
          No weigh-ins yet — log your first one below and the chart will fill in week by week.
        </template>
      </StatsWeightTrendChart>
    </PanelCard>

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Weekly weigh-in</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
            {{ overview.currentWeekLogged ? 'Update this week' : 'Log this week' }}
          </h2>
          <p class="mt-2 text-sm text-muted">
            Week of {{ formatWeek(overview.currentWeekKey) }}. One entry per week — saving again replaces it.
          </p>
        </div>
        <form class="space-y-3" @submit.prevent="saveWeighIn">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block">
              <span class="eyebrow">Weight (kg)</span>
              <input
                v-model="weightInput"
                class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
                type="number"
                step="0.1"
                min="25"
                max="400"
                placeholder="82.4"
                required
              />
            </label>
            <label class="block">
              <span class="eyebrow">Body fat % (optional)</span>
              <input
                v-model="bodyFatInput"
                class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
                type="number"
                step="0.1"
                min="2"
                max="70"
                placeholder="18.5"
              />
            </label>
          </div>
          <input
            v-model="notesInput"
            class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="text"
            placeholder="Optional note, e.g. after travel week"
          />
          <button
            class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
            :disabled="savingWeighIn || !weightInput"
          >
            {{ overview.currentWeekLogged ? 'Update weigh-in' : 'Save weigh-in' }}
          </button>
        </form>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Body profile</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Height &amp; target</h2>
        </div>
        <form class="space-y-3" @submit.prevent="saveProfile">
          <label class="block">
            <span class="eyebrow">Height (cm)</span>
            <input
              v-model="heightInput"
              class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="number"
              step="0.5"
              min="80"
              max="260"
              placeholder="182"
            />
          </label>
          <label class="block">
            <span class="eyebrow">Target weight (kg)</span>
            <input
              v-model="targetInput"
              class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
              type="number"
              step="0.1"
              min="25"
              max="400"
              placeholder="78"
            />
          </label>
          <button
            class="w-full rounded-full bg-surface-low px-5 py-3 font-semibold text-ink disabled:opacity-50"
            :disabled="savingProfile"
          >
            Save profile
          </button>
        </form>
      </PanelCard>
    </div>

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">History</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
          {{ overview.history.length }} recorded weigh-ins
        </h2>
      </div>
      <p v-if="!overview.history.length" class="text-sm text-muted">Nothing recorded yet.</p>
      <div v-else class="space-y-3">
        <div
          v-for="entry in overview.history"
          :key="entry.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-soft bg-surface-low px-5 py-4"
        >
          <div>
            <p class="font-semibold text-ink">
              {{ entry.weightKg.toFixed(1) }} kg
              <span v-if="entry.bodyFatPercent !== null" class="ml-2 text-sm font-normal text-muted">
                {{ entry.bodyFatPercent.toFixed(1) }}% body fat
              </span>
            </p>
            <p class="mt-1 text-sm text-muted">
              Week of {{ formatWeek(entry.weekKey) }}<span v-if="entry.notes"> · {{ entry.notes }}</span>
            </p>
          </div>
          <button class="text-sm font-semibold text-rose-700" @click="deleteWeighIn(entry.id)">Delete</button>
        </div>
      </div>
    </PanelCard>
  </div>
</template>
