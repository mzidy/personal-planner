<script setup lang="ts">
import type { ObjectiveRecord, ObjectiveStatus } from '~~/shared/types/planner'

definePageMeta({
  middleware: 'protected'
})

const { clear } = useUserSession()
const { data: objectives, refresh } = await usePlannerFetch<ObjectiveRecord[]>('priorities-page', '/api/priorities')
const localObjectives = ref<ObjectiveRecord[]>([])
const draggedId = ref<string | null>(null)
const hoverLane = ref<ObjectiveStatus | null>(null)
const errorMessage = ref('')

const form = reactive({
  title: '',
  detail: '',
  status: 'focus',
  urgency: 'medium',
  focusWindow: 'Morning deep work'
})

async function handlePriorityError(error: unknown, fallbackMessage: string) {
  const fetchError = error as {
    data?: { statusMessage?: string; message?: string }
    status?: number
    statusCode?: number
    statusMessage?: string
    message?: string
  }

  const status = fetchError?.status || fetchError?.statusCode

  if (status === 401) {
    await clear()
    await navigateTo('/login?reason=session-expired')
    return
  }

  const detail = fetchError?.data?.message || fetchError?.message || fallbackMessage
  const prefix = fetchError?.data?.statusMessage || fetchError?.statusMessage || 'Server Error'
  errorMessage.value = `${prefix}: ${detail}`
}

watch(
  objectives,
  value => {
    localObjectives.value = value ? [...value] : []
  },
  { immediate: true }
)

const groups = computed<{ key: ObjectiveStatus; title: string; items: ObjectiveRecord[] }[]>(() => {
  const source = localObjectives.value || []
  return [
    { key: 'focus', title: 'Immediate Action', items: source.filter(item => item.status === 'focus') },
    { key: 'scheduled', title: 'Strategic Growth', items: source.filter(item => item.status === 'scheduled') },
    { key: 'indoor', title: 'Indoor', items: source.filter(item => item.status === 'indoor' || item.status === 'delegated') },
    { key: 'outdoor', title: 'Outdoor', items: source.filter(item => item.status === 'outdoor') },
    { key: 'backlog', title: 'Backlog & Noise', items: source.filter(item => item.status === 'backlog') }
  ]
})

async function createObjective() {
  errorMessage.value = ''

  try {
    await $fetch('/api/priorities', {
      method: 'POST',
      body: form
    })
    form.title = ''
    form.detail = ''
    await refresh()
  } catch (error) {
    await handlePriorityError(error, 'Unable to add objective.')
  }
}

async function moveObjective(id: string, status: ObjectiveStatus) {
  const previous = [...localObjectives.value]
  localObjectives.value = localObjectives.value.map(item => (item.id === id ? { ...item, status } : item))

  try {
    await $fetch(`/api/priorities/${id}`, {
      method: 'PATCH',
      body: { status }
    })
    await refresh()
  } catch (error) {
    localObjectives.value = previous
    await handlePriorityError(error, 'Unable to update objective.')
  }
}

async function markDone(id: string) {
  await moveObjective(id, 'done')
}

/**
 * Deleting is irreversible and the button sits next to "Mark done", so the
 * first click only arms it; the second one actually deletes.
 */
const pendingDeleteId = ref<string | null>(null)
let disarmTimer: ReturnType<typeof setTimeout> | null = null

function armDelete(id: string) {
  pendingDeleteId.value = id
  if (disarmTimer) clearTimeout(disarmTimer)
  disarmTimer = setTimeout(() => {
    pendingDeleteId.value = null
  }, 4000)
}

function disarmDelete() {
  if (disarmTimer) clearTimeout(disarmTimer)
  pendingDeleteId.value = null
}

onBeforeUnmount(disarmDelete)

async function deleteObjective(id: string) {
  if (pendingDeleteId.value !== id) {
    armDelete(id)
    return
  }

  disarmDelete()
  errorMessage.value = ''

  try {
    await $fetch(`/api/priorities/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (error) {
    await handlePriorityError(error, 'Unable to delete that objective.')
  }
}

function dragStart(id: string) {
  draggedId.value = id
}

function dragEnd() {
  draggedId.value = null
  hoverLane.value = null
}

function dragEnterLane(status: ObjectiveStatus) {
  hoverLane.value = status
}

async function dropOnLane(status: ObjectiveStatus) {
  if (!draggedId.value) {
    return
  }

  const objective = localObjectives.value.find(item => item.id === draggedId.value)
  const draggedObjectiveId = draggedId.value

  draggedId.value = null
  hoverLane.value = null

  if (!objective || objective.status === status) {
    return
  }

  await moveObjective(draggedObjectiveId, status)
}
</script>

<template>
  <div class="space-y-8">
    <AppPageHero
      eyebrow="Operational Focus"
      title="Tasks"
      subtitle="Keep the decision-heavy work visible, move the rest to deliberate slots, and mark finished work without clutter."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Live count</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ objectives?.length || 0 }}</p>
          <p class="mt-2 text-sm text-muted">tracked objectives</p>
        </PanelCard>
      </template>
    </AppPageHero>

    <div class="grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
      <div class="grid gap-6 md:grid-cols-2">
        <PanelCard
          v-for="group in groups"
          :key="group.key"
          class="space-y-4 transition-all duration-200"
          :class="hoverLane === group.key ? 'ring-2 ring-accent/30 bg-surface' : ''"
          @dragenter.prevent="dragEnterLane(group.key)"
          @dragover.prevent="dragEnterLane(group.key)"
          @dragleave="hoverLane === group.key ? (hoverLane = null) : null"
          @drop.prevent="dropOnLane(group.key)"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="eyebrow">{{ group.title }}</p>
              <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ group.items.length }} items</h2>
            </div>
            <StatusPill
              :label="group.key"
              :tone="group.key === 'focus' ? 'ink' : group.key === 'scheduled' ? 'teal' : group.key === 'outdoor' ? 'teal' : 'mist'"
            />
          </div>
          <div class="space-y-3">
            <article
              v-for="item in group.items"
              :key="item.id"
              draggable="true"
              class="rounded-soft bg-surface-low px-5 py-4 transition-opacity duration-150"
              :class="draggedId === item.id ? 'opacity-45' : ''"
              @dragstart="dragStart(item.id)"
              @dragend="dragEnd"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-ink">{{ item.title }}</p>
                <StatusPill :label="item.urgency" :tone="item.urgency === 'critical' ? 'danger' : item.urgency === 'high' ? 'ink' : 'mist'" />
              </div>
              <p class="mt-2 text-sm leading-6 text-muted">{{ item.detail }}</p>
              <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <span>{{ item.focusWindow }}</span>
                <div class="flex items-center gap-4">
                  <button class="font-semibold text-ink" @click="markDone(item.id)">Mark done</button>
                  <button
                    class="font-semibold transition-colors"
                    :class="pendingDeleteId === item.id ? 'text-rose-700' : 'text-muted hover:text-rose-700'"
                    :aria-label="pendingDeleteId === item.id ? `Confirm deleting ${item.title}` : `Delete ${item.title}`"
                    @click="deleteObjective(item.id)"
                    @blur="pendingDeleteId === item.id && disarmDelete()"
                  >
                    {{ pendingDeleteId === item.id ? 'Confirm?' : 'Delete' }}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </PanelCard>
      </div>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">New Objective</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Capture the next deliberate move.</h2>
        </div>
        <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {{ errorMessage }}
        </p>
        <form class="space-y-3" @submit.prevent="createObjective">
          <input v-model="form.title" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" placeholder="Objective title" required />
          <textarea
            v-model="form.detail"
            class="min-h-[8rem] w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            placeholder="Describe the scope and the reason it matters."
            required
          />
          <select v-model="form.status" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option value="focus">Immediate action</option>
            <option value="scheduled">Strategic growth</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
            <option value="backlog">Backlog & noise</option>
          </select>
          <select v-model="form.urgency" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input v-model="form.focusWindow" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" placeholder="Best focus window" />
          <button class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white">Add objective</button>
        </form>
      </PanelCard>
    </div>
  </div>
</template>
