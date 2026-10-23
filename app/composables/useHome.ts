import type { DashboardPayload, ObjectiveRecord, UrgencyLevel } from '~~/shared/types/planner'
import type { RoutineDayItem, RoutineOverview, RoutineState } from '~~/shared/types/routine'
import type { SavingsGoalRecord } from '~~/shared/types/savings'
import type { StatsOverview } from '~~/shared/types/stats'
import { dueOrder, partOfDay, savingsProgress, studyDays, studyStreak, studySummary } from '~~/shared/utils/home'
import { isPlausibleWeight, localNoonIso, parseWeight, todayIso } from '~~/shared/utils/weigh-in'

const URGENCY_ORDER: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function messageOf(error: unknown, fallback: string) {
  const fetchError = error as { data?: { statusMessage?: string; message?: string } }
  return fetchError?.data?.statusMessage || fetchError?.data?.message || fallback
}

/**
 * Everything the themed home pages show and do: the same dashboard, routine
 * and stats data the executive home reads (same keys, so nothing is fetched
 * twice), plus the study log and the savings goal the teen pages add.
 */
export async function useHome() {
  // Every composable is called before the single await at the end: after an
  // await outside <script setup>, Nuxt's and Vue's context is gone.
  const dashboardFetch = usePlannerFetch<DashboardPayload>('dashboard-page', '/api/dashboard')
  const routineFetch = usePlannerFetch<RoutineOverview>('dashboard-routine', '/api/routine/overview')
  const statsFetch = usePlannerFetch<StatsOverview>('dashboard-stats', '/api/stats/overview')
  const savingsFetch = usePlannerFetch<{ goal: SavingsGoalRecord | null }>('home-savings', '/api/savings-goal')
  const { data: dashboard, refresh: refreshDashboard } = dashboardFetch
  const { data: routine, refresh: refreshRoutine } = routineFetch
  const { data: stats, refresh: refreshStats } = statsFetch
  const { data: savings } = savingsFetch
  const { firstName } = useAppTheme()

  // The server renders with its own clock (UTC on Vercel); the browser then
  // switches to local time, so "morning" and "today" are the user's.
  const hour = ref(useState('home-hour', () => new Date().getHours()).value)
  const today = ref(useState('home-today', () => todayIso()).value)
  onMounted(() => {
    hour.value = new Date().getHours()
    today.value = todayIso()
  })

  const greeting = computed(() => `Good ${partOfDay(hour.value)}, ${firstName.value}`)
  const blocksToday = computed(() => dashboard.value?.agenda.length ?? 0)

  const open = computed(() => (dashboard.value?.objectives || []).filter(item => item.status !== 'done'))
  /** Adults: most urgent first. */
  const tasksByUrgency = computed(() => [...open.value].sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9)))
  /** Teens: soonest due first. */
  const homework = computed<ObjectiveRecord[]>(() => [...open.value].sort((a, b) => dueOrder(a.dueDate) - dueOrder(b.dueDate)))
  const criticalCount = computed(() => open.value.filter(item => item.urgency === 'critical').length)

  // Routine: a click flips an item between done and planned.
  const routineItems = computed(() => routine.value?.todayItems || [])
  const routineDone = computed(() => routineItems.value.filter(item => item.state === 'done').length)
  const pendingRoutine = ref<string | null>(null)

  async function toggleRoutine(item: RoutineDayItem) {
    if (pendingRoutine.value) {
      return
    }
    pendingRoutine.value = item.templateId
    const next: RoutineState = item.state === 'done' ? 'planned' : 'done'
    try {
      await $fetch(`/api/routine/entries/${item.templateId}`, { method: 'PATCH', body: { state: next } })
      await refreshRoutine()
    } catch {
      // The pill stays as it was; the routine page is the place to recover.
    } finally {
      pendingRoutine.value = null
    }
  }

  // Weigh-in, as on the executive home.
  const weighIn = reactive({ date: todayIso(), weight: '' })
  const savingWeighIn = ref(false)
  const weighInError = ref('')
  const weighInValid = computed(() => isPlausibleWeight(parseWeight(weighIn.weight)) && Boolean(localNoonIso(weighIn.date)))

  async function saveWeighIn() {
    if (!weighInValid.value || savingWeighIn.value) {
      return
    }
    savingWeighIn.value = true
    weighInError.value = ''
    try {
      await $fetch('/api/stats/weigh-ins', {
        method: 'POST',
        body: { weightKg: parseWeight(weighIn.weight), measuredAt: localNoonIso(weighIn.date) }
      })
      weighIn.weight = ''
      await refreshStats()
    } catch (error) {
      weighInError.value = messageOf(error, 'That weigh-in could not be saved.')
    } finally {
      savingWeighIn.value = false
    }
  }

  // Study time: logged as a focus session for today.
  const sessions = computed(() => dashboard.value?.focus.sessions || [])
  const days = computed(() => studyDays(sessions.value, today.value))
  const streak = computed(() => studyStreak(sessions.value, today.value))
  const study = computed(() => studySummary(days.value))
  const studyMinutes = ref('30')
  const loggingStudy = ref(false)
  const studyError = ref('')

  async function logStudy() {
    const minutes = Math.round(Number(studyMinutes.value))
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480 || loggingStudy.value) {
      studyError.value = 'Log between 1 and 480 minutes.'
      return
    }
    loggingStudy.value = true
    studyError.value = ''
    const end = localNoonIso(todayIso())!
    try {
      await $fetch('/api/focus-sessions', {
        method: 'POST',
        body: {
          title: 'Study time',
          plannedMinutes: Math.max(15, minutes),
          actualMinutes: minutes,
          startedAt: new Date(Date.parse(end) - minutes * 60_000).toISOString(),
          endedAt: end
        }
      })
      await refreshDashboard()
    } catch (error) {
      studyError.value = messageOf(error, 'The study time could not be saved.')
    } finally {
      loggingStudy.value = false
    }
  }

  // The savings goal (teen pages).
  const goal = computed(() => savings.value?.goal ?? null)
  const goalProgress = computed(() => (goal.value ? savingsProgress(goal.value) : null))
  const editingGoal = ref(false)
  const goalForm = reactive({ title: '', targetAmount: '', savedAmount: '', weeklyAllowance: '' })
  const savingGoal = ref(false)
  const goalError = ref('')

  function editGoal() {
    goalForm.title = goal.value?.title ?? ''
    goalForm.targetAmount = goal.value ? String(goal.value.targetAmount) : ''
    goalForm.savedAmount = goal.value ? String(goal.value.savedAmount) : '0'
    goalForm.weeklyAllowance = goal.value?.weeklyAllowance != null ? String(goal.value.weeklyAllowance) : ''
    goalError.value = ''
    editingGoal.value = true
  }

  async function saveGoal() {
    const amount = (text: string) => (text.trim() ? Number(text.trim().replace(',', '.')) : null)
    const body = {
      title: goalForm.title.trim(),
      targetAmount: amount(goalForm.targetAmount),
      savedAmount: amount(goalForm.savedAmount) ?? 0,
      weeklyAllowance: amount(goalForm.weeklyAllowance)
    }
    if (!body.title || body.targetAmount === null || Number.isNaN(body.targetAmount) || Number.isNaN(body.savedAmount)) {
      goalError.value = 'Give the goal a name, a target and what is saved so far.'
      return
    }
    savingGoal.value = true
    goalError.value = ''
    try {
      savings.value = await $fetch<{ goal: SavingsGoalRecord | null }>('/api/savings-goal', { method: 'PUT', body })
      editingGoal.value = false
    } catch (error) {
      goalError.value = messageOf(error, 'The goal could not be saved.')
    } finally {
      savingGoal.value = false
    }
  }

  await Promise.all([dashboardFetch, routineFetch, statsFetch, savingsFetch])

  return {
    dashboard,
    stats,
    firstName,
    greeting,
    today,
    blocksToday,
    tasksByUrgency,
    homework,
    criticalCount,
    routineItems,
    routineDone,
    pendingRoutine,
    toggleRoutine,
    weighIn,
    weighInValid,
    weighInError,
    savingWeighIn,
    saveWeighIn,
    days,
    streak,
    study,
    studyMinutes,
    loggingStudy,
    studyError,
    logStudy,
    goal,
    goalProgress,
    editingGoal,
    goalForm,
    savingGoal,
    goalError,
    editGoal,
    saveGoal
  }
}
