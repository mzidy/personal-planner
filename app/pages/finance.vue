<script setup lang="ts">
import type { FinanceOverview } from '~~/shared/types/planner'

definePageMeta({
  middleware: 'protected'
})

const { currency, percent, shortDate, toIso } = useExecutiveFormat()
const { data: finance, refresh } = await usePlannerFetch<FinanceOverview>('finance-page', '/api/finance/overview')

const form = reactive({
  accountId: '',
  categoryId: '',
  title: 'New ledger entry',
  amount: 250,
  direction: 'expense',
  status: 'verified',
  occurredAt: new Date().toISOString().slice(0, 16),
  notes: ''
})

watch(
  finance,
  value => {
    if (!value) {
      return
    }
    form.accountId ||= value.accounts[0]?.id || ''
    form.categoryId ||= value.categories.find(item => item.type === form.direction)?.id || value.categories[0]?.id || ''
  },
  { immediate: true }
)

watch(
  () => form.direction,
  direction => {
    const category = finance.value?.categories.find(item => item.type === direction)
    if (category) {
      form.categoryId = category.id
    }
  }
)

async function createTransaction() {
  await $fetch('/api/finance/transactions', {
    method: 'POST',
    body: {
      ...form,
      amount: Number(form.amount),
      occurredAt: toIso(form.occurredAt)
    }
  })
  await refresh()
}
</script>

<template>
  <div v-if="finance" class="space-y-8">
    <AppPageHero
      eyebrow="Fiscal Summary"
      title="Your wealth is breathing."
      subtitle="Manual money tracking stays lightweight, but the monthly signal remains visible enough to guide deliberate tradeoffs."
    >
      <template #aside>
        <PanelCard class="min-w-[14rem]" tone="muted">
          <p class="eyebrow">Net worth</p>
          <p class="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">{{ currency(finance.netWorth) }}</p>
        </PanelCard>
      </template>
    </AppPageHero>

    <div class="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
      <PanelCard class="space-y-4">
        <div class="grid gap-4 md:grid-cols-4">
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Monthly spend</p>
            <p class="mt-2 text-xl font-semibold">{{ currency(finance.monthlySpend) }}</p>
          </div>
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Monthly income</p>
            <p class="mt-2 text-xl font-semibold">{{ currency(finance.monthlyIncome) }}</p>
          </div>
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Savings rate</p>
            <p class="mt-2 text-xl font-semibold">{{ percent(finance.savingsRate) }}</p>
          </div>
          <div class="rounded-soft bg-surface-low px-4 py-4">
            <p class="eyebrow">Budget health</p>
            <p class="mt-2 text-xl font-semibold">{{ finance.budgetHealth }}</p>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-soft bg-surface-low px-5 py-5">
            <p class="eyebrow">Accounts</p>
            <div class="mt-4 space-y-3">
              <div v-for="account in finance.accounts" :key="account.id" class="flex items-center justify-between gap-4">
                <div>
                  <p class="font-semibold text-ink">{{ account.name }}</p>
                  <p class="text-sm text-muted">{{ account.type }}</p>
                </div>
                <p class="font-semibold text-ink">{{ currency(account.balance) }}</p>
              </div>
            </div>
          </div>
          <div class="rounded-soft bg-surface-low px-5 py-5">
            <p class="eyebrow">Category budgets</p>
            <div class="mt-4 space-y-3">
              <div v-for="category in finance.categories.filter(item => item.type === 'expense')" :key="category.id" class="flex items-center justify-between gap-4">
                <div>
                  <p class="font-semibold text-ink">{{ category.name }}</p>
                  <p class="text-sm text-muted">{{ category.icon }}</p>
                </div>
                <p class="font-semibold text-ink">{{ category.budget ? currency(category.budget) : 'Open' }}</p>
              </div>
            </div>
          </div>
        </div>
      </PanelCard>

      <PanelCard tone="dark" class="space-y-4">
        <div>
          <p class="eyebrow text-white/55">Budget Health</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">{{ finance.budgetHealth }}</h2>
        </div>
        <p class="text-sm leading-7 text-white/78">
          You are currently tracking against the monthly threshold with room to absorb strategic travel
          without crowding out savings.
        </p>
        <div class="rounded-soft bg-white/6 px-5 py-5">
          <p class="eyebrow text-white/55">Threshold</p>
          <p class="mt-2 text-lg font-semibold text-white">
            {{ finance.target ? currency(finance.target.spendingLimit) : 'No target set' }}
          </p>
        </div>
      </PanelCard>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">Ledger Activities</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Recent transactions</h2>
        </div>
        <div class="space-y-3">
          <article v-for="item in finance.transactions" :key="item.id" class="rounded-soft bg-surface-low px-5 py-4">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-semibold text-ink">{{ item.title }}</p>
                <p class="text-sm text-muted">{{ shortDate(item.occurredAt) }} · {{ item.notes || item.status }}</p>
              </div>
              <p class="font-semibold" :class="item.direction === 'income' ? 'text-emerald-600' : 'text-ink'">
                {{ item.direction === 'income' ? '+' : '-' }}{{ currency(item.amount) }}
              </p>
            </div>
          </article>
        </div>
      </PanelCard>

      <PanelCard class="space-y-4">
        <div>
          <p class="eyebrow">New Transaction</p>
          <h2 class="mt-2 font-display text-2xl font-bold tracking-[-0.05em]">Manual money tracking</h2>
        </div>
        <form class="space-y-3" @submit.prevent="createTransaction">
          <select v-model="form.accountId" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option v-for="account in finance.accounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </select>
          <select v-model="form.direction" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <select v-model="form.categoryId" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none">
            <option v-for="category in finance.categories.filter(item => item.type === form.direction)" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <input v-model="form.title" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="text" />
          <input v-model.number="form.amount" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="number" min="1" />
          <input v-model="form.occurredAt" class="w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" type="datetime-local" />
          <textarea v-model="form.notes" class="min-h-[7rem] w-full rounded-2xl bg-surface-low px-4 py-3 outline-none" />
          <button class="w-full rounded-full bg-ink px-5 py-3 font-semibold text-white">Add transaction</button>
        </form>
      </PanelCard>
    </div>
  </div>
</template>
