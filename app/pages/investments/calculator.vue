<script setup lang="ts">
import {
  COMPOUND_LABELS,
  calculateEndAmount,
  solveContribution,
  solveReturnRate,
  solveStartingAmount,
  solveYears,
  type CompoundFrequency,
  type ContributionFrequency,
  type ContributionTiming,
  type InvestmentInputs
} from '~~/shared/utils/investment-math'

definePageMeta({
  middleware: 'protected'
})

const TABS = [
  { label: 'Overview', to: '/investments' },
  { label: 'ETF', to: '/investments/etf' },
  { label: 'Stocks', to: '/investments/stocks' },
  { label: 'Options', to: '/investments/options' },
  { label: 'Analysis', to: '/investments/analysis' },
  { label: 'Calculator', to: '/investments/calculator' }
]

const route = useRoute()

/** Which field the calculator solves for; the rest are inputs. */
type SolveFor = 'endAmount' | 'contribution' | 'returnRate' | 'startingAmount' | 'years'

const MODES: { key: SolveFor; label: string }[] = [
  { key: 'endAmount', label: 'End Amount' },
  { key: 'contribution', label: 'Additional Contribution' },
  { key: 'returnRate', label: 'Return Rate' },
  { key: 'startingAmount', label: 'Starting Amount' },
  { key: 'years', label: 'Investment Length' }
]

const mode = ref<SolveFor>('endAmount')

const form = reactive({
  startingAmount: 20000,
  years: 10,
  returnRate: 6,
  compound: 'annually' as CompoundFrequency,
  contribution: 1000,
  contributionTiming: 'end' as ContributionTiming,
  contributionFrequency: 'month' as ContributionFrequency,
  /** Only used by the four solve-for-an-input modes. */
  targetAmount: 200000
})

const COMPOUND_OPTIONS = Object.keys(COMPOUND_LABELS) as CompoundFrequency[]

const solvedLabel = computed(() => MODES.find(item => item.key === mode.value)?.label || '')

/** The field being solved for is hidden from the inputs. */
function shows(field: SolveFor) {
  return mode.value !== field
}

const inputs = computed<InvestmentInputs>(() => ({
  startingAmount: Number(form.startingAmount) || 0,
  years: Number(form.years) || 0,
  returnRate: Number(form.returnRate) || 0,
  compound: form.compound,
  contribution: Number(form.contribution) || 0,
  contributionFrequency: form.contributionFrequency,
  contributionTiming: form.contributionTiming
}))

interface Solved {
  /** The figure the active mode was asked to find, if it is not the end balance. */
  value: number | null
  unit: string
  unreachable: boolean
}

const solved = computed<Solved>(() => {
  const target = Number(form.targetAmount) || 0

  switch (mode.value) {
    case 'contribution': {
      const value = solveContribution(inputs.value, target)
      return { value, unit: `per ${form.contributionFrequency}`, unreachable: value === null }
    }
    case 'startingAmount': {
      const value = solveStartingAmount(inputs.value, target)
      return { value, unit: '', unreachable: value === null }
    }
    case 'returnRate': {
      const value = solveReturnRate(inputs.value, target)
      return { value, unit: '% per year', unreachable: value === null }
    }
    case 'years': {
      const value = solveYears(inputs.value, target)
      return { value, unit: value === 1 ? 'year' : 'years', unreachable: value === null }
    }
    default:
      return { value: null, unit: '', unreachable: false }
  }
})

/**
 * Once a solver has found the missing figure, the full breakdown is produced by
 * feeding it back through the forward calculation — so every mode shows the
 * same four totals and the same schedule.
 */
const result = computed(() => {
  if (mode.value === 'endAmount') {
    return calculateEndAmount(inputs.value)
  }

  const value = solved.value.value
  if (value === null) {
    return null
  }

  switch (mode.value) {
    case 'contribution':
      return calculateEndAmount({ ...inputs.value, contribution: value })
    case 'startingAmount':
      return calculateEndAmount({ ...inputs.value, startingAmount: value })
    case 'returnRate':
      return calculateEndAmount({ ...inputs.value, returnRate: value })
    case 'years':
      return calculateEndAmount({ ...inputs.value, years: value })
    default:
      return null
  }
})

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

// ---- Donut ----------------------------------------------------------------
const SEGMENTS = [
  { key: 'startingAmount', label: 'Starting Amount', tone: 'text-ink' },
  { key: 'totalContributions', label: 'Total Contributions', tone: 'text-teal' },
  { key: 'totalInterest', label: 'Interest', tone: 'text-rose-400' }
] as const

const donut = computed(() => {
  const current = result.value
  if (!current) {
    return []
  }

  // Negative parts (a solver can return a negative starting amount) would break
  // the arc maths, so they are clamped to zero for the chart only.
  const parts = SEGMENTS.map(segment => ({
    ...segment,
    value: Math.max(0, current[segment.key])
  }))
  const total = parts.reduce((sum, part) => sum + part.value, 0)

  if (total <= 0) {
    return []
  }

  const radius = 60
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return parts.map(part => {
    const fraction = part.value / total
    const segment = {
      ...part,
      percent: Math.round(fraction * 100),
      dash: `${fraction * circumference} ${circumference}`,
      offset: -offset * circumference
    }
    offset += fraction
    return segment
  })
})
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Calculator"
      title="Investment calculator"
      subtitle="Solve for any one of the five figures — leave the rest as inputs and the calculator finds the missing one."
    >
      <template #aside>
        <PanelCard class="min-w-[15rem]" tone="muted">
          <p class="eyebrow">End balance</p>
          <p class="mt-3 font-display text-3xl font-bold tracking-[-0.05em]">
            {{ money(result?.endBalance) }}
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

    <!-- Solve-for selector -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="item in MODES"
        :key="item.key"
        type="button"
        class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
        :class="mode === item.key ? 'bg-accent text-white' : 'bg-surface-low text-ink hover:bg-surface'"
        @click="mode = item.key"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <!-- Inputs -->
      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Inputs</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">
            Solving for {{ solvedLabel }}
          </h2>
        </div>

        <label v-if="mode !== 'endAmount'" class="block">
          <span class="eyebrow">Target end balance</span>
          <input
            v-model.number="form.targetAmount"
            class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="number"
            min="0"
            step="1000"
          />
        </label>

        <label v-if="shows('startingAmount')" class="block">
          <span class="eyebrow">Starting amount</span>
          <input
            v-model.number="form.startingAmount"
            class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="number"
            step="1000"
          />
        </label>

        <label v-if="shows('years')" class="block">
          <span class="eyebrow">After (years)</span>
          <input
            v-model.number="form.years"
            class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="number"
            min="0"
            step="1"
          />
        </label>

        <label v-if="shows('returnRate')" class="block">
          <span class="eyebrow">Return rate (%)</span>
          <input
            v-model.number="form.returnRate"
            class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="number"
            step="0.1"
          />
        </label>

        <label class="block">
          <span class="eyebrow">Compound</span>
          <select
            v-model="form.compound"
            class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
          >
            <option v-for="option in COMPOUND_OPTIONS" :key="option" :value="option">
              {{ COMPOUND_LABELS[option] }}
            </option>
          </select>
        </label>

        <label v-if="shows('contribution')" class="block">
          <span class="eyebrow">Additional contribution</span>
          <input
            v-model.number="form.contribution"
            class="mt-2 w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="number"
            step="100"
          />
        </label>

        <div class="rounded-soft bg-surface-low px-4 py-4">
          <p class="eyebrow">Contribute at the</p>
          <div class="mt-3 flex flex-wrap items-center gap-4">
            <label v-for="timing in (['beginning', 'end'] as const)" :key="timing" class="flex items-center gap-2">
              <input v-model="form.contributionTiming" :value="timing" type="radio" class="h-4 w-4 accent-black" />
              <span class="text-sm font-medium text-ink">{{ timing }}</span>
            </label>
          </div>
          <p class="eyebrow mt-4">of each</p>
          <div class="mt-3 flex flex-wrap items-center gap-4">
            <label v-for="freq in (['month', 'year'] as const)" :key="freq" class="flex items-center gap-2">
              <input v-model="form.contributionFrequency" :value="freq" type="radio" class="h-4 w-4 accent-black" />
              <span class="text-sm font-medium text-ink">{{ freq }}</span>
            </label>
          </div>
        </div>
      </PanelCard>

      <!-- Results -->
      <PanelCard class="space-y-5">
        <div>
          <p class="eyebrow">Results</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Breakdown</h2>
        </div>

        <p
          v-if="solved.unreachable"
          class="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        >
          That target cannot be reached with these inputs. Try a longer term, a higher contribution, or a
          higher return.
        </p>

        <div v-else-if="result" class="space-y-5">
          <div
            v-if="mode !== 'endAmount' && solved.value !== null"
            class="rounded-soft bg-accent px-5 py-5 text-white"
          >
            <p class="eyebrow text-white/55">Required {{ solvedLabel.toLowerCase() }}</p>
            <p class="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">
              {{
                mode === 'returnRate' || mode === 'years'
                  ? `${solved.value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${solved.unit}`
                  : `${money(solved.value)} ${solved.unit}`
              }}
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-4 border-b border-outline/10 pb-2">
              <span class="font-semibold text-ink">End Balance</span>
              <span class="font-display text-xl font-bold tracking-[-0.03em]">
                {{ money(result.endBalance) }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted">Starting Amount</span>
              <span class="font-semibold text-ink">{{ money(result.startingAmount) }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted">Total Contributions</span>
              <span class="font-semibold text-ink">{{ money(result.totalContributions) }}</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted">Total Interest</span>
              <span class="font-semibold text-ink">{{ money(result.totalInterest) }}</span>
            </div>
          </div>

          <!-- Donut -->
          <div v-if="donut.length" class="flex flex-wrap items-center gap-6">
            <svg viewBox="0 0 160 160" class="h-40 w-40 shrink-0 -rotate-90" role="img" aria-label="Balance composition">
              <circle
                v-for="segment in donut"
                :key="segment.key"
                cx="80"
                cy="80"
                r="60"
                fill="none"
                stroke="currentColor"
                stroke-width="28"
                :stroke-dasharray="segment.dash"
                :stroke-dashoffset="segment.offset"
                :class="segment.tone"
              />
            </svg>
            <ul class="space-y-2">
              <li v-for="segment in donut" :key="segment.key" class="flex items-center gap-3">
                <span class="h-3 w-3 shrink-0 rounded-sm bg-current" :class="segment.tone"></span>
                <span class="text-sm text-muted">{{ segment.label }}</span>
                <span class="text-sm font-semibold text-ink">{{ segment.percent }}%</span>
              </li>
            </ul>
          </div>
        </div>
      </PanelCard>
    </div>

    <!-- Yearly schedule -->
    <PanelCard v-if="result && result.schedule.length" class="space-y-4">
      <div>
        <p class="eyebrow">Year by year</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Accumulation schedule</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[34rem] text-sm">
          <thead>
            <tr class="border-b border-outline/15 text-left">
              <th class="py-2 pr-4 font-semibold text-ink">Year</th>
              <th class="py-2 pr-4 text-right font-semibold text-ink">Start</th>
              <th class="py-2 pr-4 text-right font-semibold text-ink">Contributions</th>
              <th class="py-2 pr-4 text-right font-semibold text-ink">Interest</th>
              <th class="py-2 text-right font-semibold text-ink">End</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in result.schedule" :key="row.year" class="border-b border-outline/8">
              <td class="py-2 pr-4 text-muted">{{ row.year }}</td>
              <td class="py-2 pr-4 text-right text-muted">{{ money(row.startBalance) }}</td>
              <td class="py-2 pr-4 text-right text-muted">{{ money(row.contributions) }}</td>
              <td class="py-2 pr-4 text-right text-muted">{{ money(row.interest) }}</td>
              <td class="py-2 text-right font-semibold text-ink">{{ money(row.endBalance) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs leading-5 text-muted">
        The return rate is compounded {{ COMPOUND_LABELS[form.compound] }} and converted to the equivalent
        rate for each contribution period. Figures are before tax, fees and inflation.
      </p>
    </PanelCard>
  </div>
</template>
