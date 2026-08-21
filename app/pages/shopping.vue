<script setup lang="ts">
import type { ShoppingHorizon, ShoppingItemRecord, ShoppingOverview } from '~~/shared/types/shopping'

definePageMeta({
  middleware: 'protected'
})

const { data: overview, refresh } = await usePlannerFetch<ShoppingOverview>('shopping-overview', '/api/shopping/overview')

type BoughtFilter = 'all' | 'open' | 'bought'

const filter = ref<BoughtFilter>('open')
const filters: { value: BoughtFilter; label: string }[] = [
  { value: 'open', label: 'To buy' },
  { value: 'bought', label: 'Bought' },
  { value: 'all', label: 'All' }
]

const form = reactive({
  name: '',
  description: '',
  price: '',
  horizon: 'short' as ShoppingHorizon
})

const saving = ref(false)
const errorMessage = ref('')

function visibleItems(items: ShoppingItemRecord[]) {
  if (filter.value === 'open') {
    return items.filter(item => !item.bought)
  }
  if (filter.value === 'bought') {
    return items.filter(item => item.bought)
  }
  return items
}

const visibleTotal = computed(() =>
  (overview.value?.groups || []).reduce((count, group) => count + visibleItems(group.items).length, 0)
)

function formatPrice(value: number | null) {
  if (value === null) {
    return null
  }
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

async function addItem() {
  const name = form.name.trim()
  if (!name || saving.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/shopping/items', {
      method: 'POST',
      body: {
        horizon: form.horizon,
        name,
        description: form.description.trim(),
        price: form.price.trim() ? Number(form.price) : null
      }
    })
    form.name = ''
    form.description = ''
    form.price = ''
    await refresh()
  } catch {
    errorMessage.value = 'Unable to add that item. Check the name and price.'
  } finally {
    saving.value = false
  }
}

async function toggleBought(item: ShoppingItemRecord) {
  errorMessage.value = ''

  try {
    await $fetch(`/api/shopping/items/${item.id}`, {
      method: 'PATCH',
      body: { bought: !item.bought }
    })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to update that item.'
  }
}

async function moveItem(item: ShoppingItemRecord, horizon: ShoppingHorizon) {
  if (item.horizon === horizon) {
    return
  }

  errorMessage.value = ''

  try {
    await $fetch(`/api/shopping/items/${item.id}`, { method: 'PATCH', body: { horizon } })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to move that item.'
  }
}

async function deleteItem(item: ShoppingItemRecord) {
  errorMessage.value = ''

  try {
    await $fetch(`/api/shopping/items/${item.id}`, { method: 'DELETE' })
    await refresh()
  } catch {
    errorMessage.value = 'Unable to delete that item.'
  }
}
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <AppPageHero
      eyebrow="Deliberate Spending"
      title="Shopping list"
      subtitle="Sort what you want to buy by how soon it matters, then tick things off as they land."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Still to buy</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ overview.openCount }}</p>
          <p class="mt-2 text-sm text-muted">{{ formatPrice(overview.openCost) }} outstanding</p>
        </PanelCard>
      </template>
    </AppPageHero>

    <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <div class="grid gap-4 md:grid-cols-3">
      <PanelCard>
        <p class="eyebrow">Tracked items</p>
        <p class="mt-2 text-2xl font-semibold">{{ overview.totalCount }}</p>
      </PanelCard>
      <PanelCard>
        <p class="eyebrow">Outstanding cost</p>
        <p class="mt-2 text-2xl font-semibold">{{ formatPrice(overview.openCost) }}</p>
        <p class="mt-1 text-sm text-muted">Priced items only</p>
      </PanelCard>
      <PanelCard>
        <p class="eyebrow">Already bought</p>
        <p class="mt-2 text-2xl font-semibold">{{ overview.boughtCount }}</p>
        <p class="mt-1 text-sm text-muted">{{ formatPrice(overview.boughtCost) }} spent</p>
      </PanelCard>
    </div>

    <PanelCard class="space-y-4">
      <div>
        <p class="eyebrow">New Item</p>
        <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Add something to buy.</h2>
      </div>
      <form class="space-y-3" @submit.prevent="addItem">
        <div class="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <input
            v-model="form.name"
            class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="text"
            placeholder="Item name, e.g. Standing desk"
            required
          />
          <input
            v-model="form.price"
            class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
            type="number"
            step="0.01"
            min="0"
            placeholder="Price (optional)"
          />
          <select v-model="form.horizon" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option value="short">Short-term</option>
            <option value="medium">Medium-term</option>
            <option value="long">Long-term</option>
          </select>
        </div>
        <input
          v-model="form.description"
          class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none"
          type="text"
          placeholder="Description (optional), e.g. electric, 160cm wide"
        />
        <button
          class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"
          :disabled="saving || !form.name.trim()"
        >
          Add item
        </button>
      </form>
    </PanelCard>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <button
          v-for="option in filters"
          :key="option.value"
          class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
          :class="filter === option.value ? 'bg-ink text-white' : 'bg-surface-low text-ink'"
          @click="filter = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <p class="text-sm text-muted">Showing {{ visibleTotal }} of {{ overview.totalCount }} items</p>
    </div>

    <div class="grid gap-6 xl:grid-cols-3">
      <PanelCard v-for="group in overview.groups" :key="group.horizon" class="space-y-4">
        <div>
          <p class="eyebrow">{{ group.label }}</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ group.openCount }} to buy</h2>
          <p class="mt-1 text-sm text-muted">{{ group.blurb }}</p>
          <p class="mt-2 text-sm font-semibold text-ink">
            {{ formatPrice(group.openCost) }}
            <span class="font-normal text-muted"> · {{ group.boughtCount }} bought</span>
          </p>
        </div>

        <p v-if="!visibleItems(group.items).length" class="rounded-soft bg-surface-low px-4 py-6 text-center text-sm text-muted">
          {{ filter === 'bought' ? 'Nothing bought here yet.' : filter === 'open' ? 'Nothing on the list.' : 'No items yet.' }}
        </p>

        <div v-else class="space-y-3">
          <article
            v-for="item in visibleItems(group.items)"
            :key="item.id"
            class="rounded-soft bg-surface-low px-4 py-4"
            :class="item.bought ? 'opacity-60' : ''"
          >
            <div class="flex items-start gap-3">
              <input
                :id="`bought-${item.id}`"
                class="mt-1 h-4 w-4 shrink-0 accent-black"
                type="checkbox"
                :checked="item.bought"
                @change="toggleBought(item)"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <label
                    :for="`bought-${item.id}`"
                    class="cursor-pointer font-semibold text-ink"
                    :class="item.bought ? 'line-through' : ''"
                  >
                    {{ item.name }}
                  </label>
                  <span v-if="item.price !== null" class="text-sm font-semibold text-ink">
                    {{ formatPrice(item.price) }}
                  </span>
                </div>
                <p v-if="item.description" class="mt-1 text-sm leading-6 text-muted">{{ item.description }}</p>
                <div class="mt-3 flex items-center justify-between gap-3">
                  <select
                    class="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink outline-none"
                    :value="item.horizon"
                    @change="moveItem(item, ($event.target as HTMLSelectElement).value as ShoppingHorizon)"
                  >
                    <option value="short">Short-term</option>
                    <option value="medium">Medium-term</option>
                    <option value="long">Long-term</option>
                  </select>
                  <button class="text-xs font-semibold text-rose-700" @click="deleteItem(item)">Delete</button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </PanelCard>
    </div>
  </div>
</template>
