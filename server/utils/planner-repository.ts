import { format, isSameDay, parseISO } from 'date-fns'
import type {
  AiBriefPayload,
  FinanceOverview,
  GoalAreaWithMilestones,
  ObjectiveRecord,
  PlannerState,
  PlannerUserRecord,
  Provider,
  VerificationTokenRecord
} from '~~/shared/types/planner'
import { readPlannerState, writePlannerState } from '~~/server/utils/planner-store'
import { createId } from '~~/server/utils/id'
import { createOpaqueToken, hashOpaqueToken } from '~~/server/utils/tokens'
import { calculateBudgetHealth, calculateCompletionRate, calculateSavingsRate } from '~~/shared/utils/planner-metrics'

function nowIso() {
  return new Date().toISOString()
}

function monthKey(date = new Date()) {
  return format(date, 'yyyy-MM')
}

function sessionDateLabel(date = new Date()) {
  return format(date, 'EEEE, MMMM d')
}

function bestFocusWindow() {
  return '07:00 AM - 10:00 AM'
}

function sortByNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function userRecords(state: PlannerState, userId: string) {
  return {
    objectives: state.objectives.filter(item => item.userId === userId),
    tasks: state.tasks.filter(item => item.userId === userId),
    timeBlocks: state.timeBlocks.filter(item => item.userId === userId),
    focusSessions: state.focusSessions.filter(item => item.userId === userId),
    journalEntries: state.journalEntries.filter(item => item.userId === userId),
    goalAreas: state.goalAreas.filter(item => item.userId === userId),
    goalMilestones: state.goalMilestones.filter(item => item.userId === userId),
    financeAccounts: state.financeAccounts.filter(item => item.userId === userId),
    financeCategories: state.financeCategories.filter(item => item.userId === userId),
    financeTransactions: state.financeTransactions.filter(item => item.userId === userId),
    monthlyTargets: state.monthlyTargets.filter(item => item.userId === userId),
    aiBriefs: state.aiBriefs.filter(item => item.userId === userId)
  }
}

function buildFinanceOverview(state: PlannerState, userId: string): FinanceOverview {
  const records = userRecords(state, userId)
  const target = records.monthlyTargets.find(item => item.monthKey === monthKey()) || records.monthlyTargets[0] || null
  const transactionsThisMonth = records.financeTransactions.filter(item => item.occurredAt.startsWith(monthKey()))
  const monthlySpend = transactionsThisMonth
    .filter(item => item.direction === 'expense')
    .reduce((sum, item) => sum + item.amount, 0)
  const monthlyIncome = transactionsThisMonth
    .filter(item => item.direction === 'income')
    .reduce((sum, item) => sum + item.amount, 0)
  const netWorth = records.financeAccounts.reduce((sum, item) => sum + item.balance, 0)
  const savingsRate = calculateSavingsRate(monthlyIncome, monthlySpend)
  const budgetHealth = calculateBudgetHealth(target?.spendingLimit, monthlySpend)

  return {
    netWorth,
    monthlySpend,
    monthlyIncome,
    savingsRate,
    budgetHealth,
    target,
    accounts: records.financeAccounts,
    categories: records.financeCategories,
    transactions: sortByNewest(records.financeTransactions)
  }
}

function buildGoals(state: PlannerState, userId: string): GoalAreaWithMilestones[] {
  const records = userRecords(state, userId)
  return records.goalAreas.map(goal => ({
    ...goal,
    milestones: records.goalMilestones.filter(item => item.goalAreaId === goal.id)
  }))
}

function buildAiBrief(state: PlannerState, userId: string): AiBriefPayload {
  const records = userRecords(state, userId)
  const today = new Date()
  const todayAgenda = records.timeBlocks
    .filter(item => isSameDay(parseISO(item.startsAt), today))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const openObjectives = records.objectives.filter(item => item.status !== 'done')
  const finance = buildFinanceOverview(state, userId)
  const nextAgenda = todayAgenda[0]

  return {
    headline: 'Your afternoon remains structurally sound.',
    summary: `You have ${openObjectives.length} active priorities, ${todayAgenda.length} scheduled blocks today, and ${finance.monthlySpend.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in verified spend this month.`,
    recommendations: [
      nextAgenda
        ? `Protect ${format(parseISO(nextAgenda.startsAt), 'HH:mm')} for ${nextAgenda.title.toLowerCase()}.`
        : 'Add one deliberate focus block to tomorrow morning.',
      finance.savingsRate >= 25
        ? 'Keep discretionary spend paused until the portfolio review is closed.'
        : 'Tighten non-essential spend before the next travel confirmation.'
    ],
    metrics: [
      {
        label: 'Focus minutes',
        value: `${records.focusSessions.reduce((sum, item) => sum + item.actualMinutes, 0)} min`
      },
      {
        label: 'Open priorities',
        value: String(openObjectives.length)
      },
      {
        label: 'Savings rate',
        value: `${finance.savingsRate}%`
      }
    ]
  }
}

function buildGreeting(name: string) {
  const hour = new Date().getHours()

  if (hour < 12) {
    return `Good morning, ${name.split(' ')[0]}.`
  }

  if (hour < 18) {
    return `Good afternoon, ${name.split(' ')[0]}.`
  }

  return `Good evening, ${name.split(' ')[0]}.`
}

export function usePlannerRepository() {
  return {
    async getBootstrap() {
      const state = await readPlannerState()
      const config = useRuntimeConfig()
      const demoBootstrapEligible =
        !config.databaseUrl && state.users.length === 1 && state.users[0]?.email === config.demoUserEmail
      return {
        demoMode: !config.databaseUrl,
        singleUserMode: config.singleUserMode,
        canRegister: state.users.length === 0 || demoBootstrapEligible,
        demoCredentials: demoBootstrapEligible
          ? {
              email: config.demoUserEmail,
              password: config.demoUserPassword
            }
          : null
      }
    },

    async countUsers() {
      const state = await readPlannerState()
      return state.users.length
    },

    async findUserByEmail(email: string) {
      const state = await readPlannerState()
      return state.users.find(item => item.email.toLowerCase() === email.toLowerCase()) || null
    },

    async findUserById(userId: string) {
      const state = await readPlannerState()
      return state.users.find(item => item.id === userId) || null
    },

    async findUserByIdentity(provider: Provider, providerUserId: string) {
      const state = await readPlannerState()
      const identity = state.authIdentities.find(item => item.provider === provider && item.providerUserId === providerUserId)
      if (!identity) {
        return null
      }

      return state.users.find(item => item.id === identity.userId) || null
    },

    async createUser(input: { email: string; displayName: string; passwordHash: string | null; emailVerified?: boolean }) {
      const state = await readPlannerState()
      const timestamp = nowIso()
      const user: PlannerUserRecord = {
        id: createId('user'),
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        avatarInitials: input.displayName
          .split(' ')
          .map(part => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        role: 'owner',
        emailVerified: Boolean(input.emailVerified),
        passwordHash: input.passwordHash,
        createdAt: timestamp,
        updatedAt: timestamp
      }

      state.users.push(user)
      await writePlannerState(state)
      return user
    },

    async promoteDemoUser(input: { email: string; displayName: string; passwordHash: string }) {
      const state = await readPlannerState()
      const config = useRuntimeConfig()
      const user = state.users[0]

      if (!user || state.users.length !== 1 || user.email !== config.demoUserEmail) {
        return null
      }

      user.email = input.email.toLowerCase()
      user.displayName = input.displayName
      user.avatarInitials = input.displayName
        .split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
      user.passwordHash = input.passwordHash
      user.emailVerified = false
      user.updatedAt = nowIso()

      await writePlannerState(state)
      return user
    },

    async linkIdentity(userId: string, provider: Provider, providerUserId: string) {
      const state = await readPlannerState()
      const exists = state.authIdentities.some(
        item => item.userId === userId && item.provider === provider && item.providerUserId === providerUserId
      )

      if (!exists) {
        state.authIdentities.push({
          id: createId('identity'),
          userId,
          provider,
          providerUserId,
          createdAt: nowIso()
        })
        await writePlannerState(state)
      }
    },

    async updateUserPassword(userId: string, passwordHash: string) {
      const state = await readPlannerState()
      const user = state.users.find(item => item.id === userId)
      if (!user) {
        return null
      }
      user.passwordHash = passwordHash
      user.updatedAt = nowIso()
      await writePlannerState(state)
      return user
    },

    async markEmailVerified(userId: string) {
      const state = await readPlannerState()
      const user = state.users.find(item => item.id === userId)
      if (!user) {
        return null
      }
      user.emailVerified = true
      user.updatedAt = nowIso()
      await writePlannerState(state)
      return user
    },

    async createPasswordResetToken(userId: string) {
      const state = await readPlannerState()
      const rawToken = createOpaqueToken()
      const record: VerificationTokenRecord = {
        id: createId('reset'),
        userId,
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
        usedAt: null,
        createdAt: nowIso()
      }

      state.passwordResetTokens.push(record)
      await writePlannerState(state)
      return rawToken
    },

    async consumePasswordResetToken(token: string) {
      const state = await readPlannerState()
      const record = state.passwordResetTokens.find(item => item.tokenHash === hashOpaqueToken(token))

      if (!record || record.usedAt || Date.parse(record.expiresAt) < Date.now()) {
        return null
      }

      record.usedAt = nowIso()
      await writePlannerState(state)
      return record
    },

    async createEmailVerificationToken(userId: string) {
      const state = await readPlannerState()
      const rawToken = createOpaqueToken()
      const record: VerificationTokenRecord = {
        id: createId('verify'),
        userId,
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        usedAt: null,
        createdAt: nowIso()
      }

      state.emailVerificationTokens.push(record)
      await writePlannerState(state)
      return rawToken
    },

    async consumeEmailVerificationToken(token: string) {
      const state = await readPlannerState()
      const record = state.emailVerificationTokens.find(item => item.tokenHash === hashOpaqueToken(token))

      if (!record || record.usedAt || Date.parse(record.expiresAt) < Date.now()) {
        return null
      }

      record.usedAt = nowIso()
      await writePlannerState(state)
      return record
    },

    async createAuditEvent(userId: string | null, action: string, entity: string, entityId: string | null, context: Record<string, unknown> = {}) {
      const state = await readPlannerState()
      state.auditEvents.unshift({
        id: createId('audit'),
        userId,
        action,
        entity,
        entityId,
        context,
        createdAt: nowIso()
      })
      await writePlannerState(state)
    },

    async listObjectives(userId: string) {
      const state = await readPlannerState()
      return sortByNewest(userRecords(state, userId).objectives)
    },

    async createObjective(userId: string, input: Omit<ObjectiveRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
      const state = await readPlannerState()
      const record: ObjectiveRecord = {
        id: createId('objective'),
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...input
      }
      state.objectives.unshift(record)
      await writePlannerState(state)
      return record
    },

    async updateObjective(userId: string, objectiveId: string, patch: Partial<ObjectiveRecord>) {
      const state = await readPlannerState()
      const record = state.objectives.find(item => item.userId === userId && item.id === objectiveId)
      if (!record) {
        return null
      }
      Object.assign(record, patch, { updatedAt: nowIso() })
      await writePlannerState(state)
      return record
    },

    async listTimeBlocks(userId: string) {
      const state = await readPlannerState()
      return [...userRecords(state, userId).timeBlocks].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    },

    async createTimeBlock(userId: string, input: Record<string, unknown>) {
      const state = await readPlannerState()
      const record = {
        id: createId('block'),
        userId,
        objectiveId: (input.objectiveId as string | null) || null,
        title: String(input.title),
        description: String(input.description || ''),
        startsAt: String(input.startsAt),
        endsAt: String(input.endsAt),
        kind: input.kind as 'meeting' | 'focus' | 'travel' | 'admin',
        tone: input.tone as 'ink' | 'teal' | 'mist',
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      state.timeBlocks.push(record)
      await writePlannerState(state)
      return record
    },

    async updateTimeBlock(userId: string, blockId: string, patch: Record<string, unknown>) {
      const state = await readPlannerState()
      const record = state.timeBlocks.find(item => item.userId === userId && item.id === blockId)
      if (!record) {
        return null
      }
      Object.assign(record, patch, { updatedAt: nowIso() })
      await writePlannerState(state)
      return record
    },

    async listFocusSessions(userId: string) {
      const state = await readPlannerState()
      return sortByNewest(userRecords(state, userId).focusSessions)
    },

    async createFocusSession(userId: string, input: Record<string, unknown>) {
      const state = await readPlannerState()
      const record = {
        id: createId('focus'),
        userId,
        objectiveId: (input.objectiveId as string | null) || null,
        title: String(input.title),
        plannedMinutes: Number(input.plannedMinutes),
        actualMinutes: Number(input.actualMinutes),
        startedAt: String(input.startedAt),
        endedAt: String(input.endedAt),
        dayKey: String(input.startedAt).slice(0, 10),
        createdAt: nowIso()
      }
      state.focusSessions.unshift(record)
      await writePlannerState(state)
      return record
    },

    async listJournalEntries(userId: string) {
      const state = await readPlannerState()
      return sortByNewest(userRecords(state, userId).journalEntries)
    },

    async createJournalEntry(userId: string, input: Record<string, unknown>) {
      const state = await readPlannerState()
      const record = {
        id: createId('journal'),
        userId,
        title: String(input.title),
        body: String(input.body),
        prompt: String(input.prompt || ''),
        focusTag: String(input.focusTag || 'Reflection'),
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      state.journalEntries.unshift(record)
      await writePlannerState(state)
      return record
    },

    async updateJournalEntry(userId: string, entryId: string, patch: Record<string, unknown>) {
      const state = await readPlannerState()
      const record = state.journalEntries.find(item => item.userId === userId && item.id === entryId)
      if (!record) {
        return null
      }
      Object.assign(record, patch, { updatedAt: nowIso() })
      await writePlannerState(state)
      return record
    },

    async listGoalAreas(userId: string) {
      const state = await readPlannerState()
      return buildGoals(state, userId)
    },

    async createGoalArea(userId: string, input: Record<string, unknown>) {
      const state = await readPlannerState()
      const record = {
        id: createId('goal'),
        userId,
        title: String(input.title),
        summary: String(input.summary),
        currentPercent: Number(input.currentPercent),
        targetPercent: Number(input.targetPercent),
        tone: input.tone as 'ink' | 'teal' | 'mist',
        dueDate: (input.dueDate as string | null) || null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      state.goalAreas.unshift(record)
      await writePlannerState(state)
      return record
    },

    async updateGoalArea(userId: string, goalId: string, patch: Record<string, unknown>) {
      const state = await readPlannerState()
      const record = state.goalAreas.find(item => item.userId === userId && item.id === goalId)
      if (!record) {
        return null
      }
      Object.assign(record, patch, { updatedAt: nowIso() })
      await writePlannerState(state)
      return record
    },

    async getFinanceOverview(userId: string) {
      const state = await readPlannerState()
      return buildFinanceOverview(state, userId)
    },

    async createFinanceTransaction(userId: string, input: Record<string, unknown>) {
      const state = await readPlannerState()
      const record = {
        id: createId('txn'),
        userId,
        accountId: String(input.accountId),
        categoryId: String(input.categoryId),
        title: String(input.title),
        amount: Number(input.amount),
        direction: input.direction as 'income' | 'expense',
        status: input.status as 'pending' | 'verified',
        occurredAt: String(input.occurredAt),
        notes: String(input.notes || ''),
        createdAt: nowIso()
      }
      state.financeTransactions.unshift(record)

      const account = state.financeAccounts.find(item => item.userId === userId && item.id === record.accountId)
      if (account) {
        account.balance += record.direction === 'income' ? record.amount : -record.amount
      }

      await writePlannerState(state)
      return record
    },

    async getDashboard(userId: string) {
      const state = await readPlannerState()
      const user = state.users.find(item => item.id === userId)
      if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found.' })
      }

      const records = userRecords(state, userId)
      const today = new Date()
      const agenda = records.timeBlocks
        .filter(item => isSameDay(parseISO(item.startsAt), today))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      const focus = records.focusSessions.reduce(
        (acc, item) => {
          acc.actualMinutes += item.actualMinutes
          acc.plannedMinutes += item.plannedMinutes
          return acc
        },
        { actualMinutes: 0, plannedMinutes: 0 }
      )
      const completed = records.objectives.filter(item => item.status === 'done').length
      const completionRate = calculateCompletionRate(records.objectives.length, completed)

      return {
        greeting: buildGreeting(user.displayName),
        dateLabel: sessionDateLabel(today),
        completionRate,
        agenda,
        objectives: records.objectives,
        focus: {
          ...focus,
          bestWindow: bestFocusWindow(),
          sessions: records.focusSessions
        },
        finance: buildFinanceOverview(state, userId),
        goals: buildGoals(state, userId),
        quickJournalPrompt: 'What deserves protection before the day fragments?',
        aiBrief: buildAiBrief(state, userId)
      }
    },

    async getAiBrief(userId: string) {
      const state = await readPlannerState()
      const brief = buildAiBrief(state, userId)
      state.aiBriefs.unshift({
        id: createId('brief'),
        userId,
        kind: 'daily',
        headline: brief.headline,
        summary: brief.summary,
        recommendations: brief.recommendations,
        createdAt: nowIso()
      })
      await writePlannerState(state)
      return brief
    }
  }
}
