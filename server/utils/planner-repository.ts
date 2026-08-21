import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { format, isSameDay, parseISO } from 'date-fns'
import type {
  AiBriefPayload,
  FinanceOverview,
  FinanceAccountRecord,
  FinanceCategoryRecord,
  FinanceTransactionRecord,
  FocusSessionRecord,
  GoalAreaWithMilestones,
  JournalEntryRecord,
  MonthlyTargetRecord,
  ObjectiveRecord,
  PlannerUserRecord,
  Provider,
  TimeBlockRecord,
  VerificationTokenRecord
} from '~~/shared/types/planner'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
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

async function buildFinanceOverview(userId: string): Promise<FinanceOverview> {
  const db = useDatabase()
  const accounts = (await db
    .select()
    .from(tables.financeAccounts)
    .where(eq(tables.financeAccounts.userId, userId))) as FinanceAccountRecord[]
  const categories = (await db
    .select()
    .from(tables.financeCategories)
    .where(eq(tables.financeCategories.userId, userId))) as FinanceCategoryRecord[]
  const transactions = (await db
    .select()
    .from(tables.financeTransactions)
    .where(eq(tables.financeTransactions.userId, userId))
    .orderBy(desc(tables.financeTransactions.createdAt))) as FinanceTransactionRecord[]
  const targets = (await db
    .select()
    .from(tables.monthlyTargets)
    .where(eq(tables.monthlyTargets.userId, userId))) as MonthlyTargetRecord[]

  const target = targets.find(item => item.monthKey === monthKey()) || targets[0] || null
  const transactionsThisMonth = transactions.filter(item => item.occurredAt.startsWith(monthKey()))
  const monthlySpend = transactionsThisMonth
    .filter(item => item.direction === 'expense')
    .reduce((sum, item) => sum + item.amount, 0)
  const monthlyIncome = transactionsThisMonth
    .filter(item => item.direction === 'income')
    .reduce((sum, item) => sum + item.amount, 0)
  const netWorth = accounts.reduce((sum, item) => sum + item.balance, 0)
  const savingsRate = calculateSavingsRate(monthlyIncome, monthlySpend)
  const budgetHealth = calculateBudgetHealth(target?.spendingLimit, monthlySpend)

  return {
    netWorth,
    monthlySpend,
    monthlyIncome,
    savingsRate,
    budgetHealth,
    target,
    accounts,
    categories,
    transactions
  }
}

async function buildGoals(userId: string): Promise<GoalAreaWithMilestones[]> {
  const db = useDatabase()
  const areas = await db
    .select()
    .from(tables.goalAreas)
    .where(eq(tables.goalAreas.userId, userId))
    .orderBy(desc(tables.goalAreas.createdAt))
  const milestones = await db
    .select()
    .from(tables.goalMilestones)
    .where(eq(tables.goalMilestones.userId, userId))

  return areas.map(goal => ({
    ...goal,
    milestones: milestones.filter(item => item.goalAreaId === goal.id)
  })) as GoalAreaWithMilestones[]
}

async function buildAiBrief(userId: string): Promise<AiBriefPayload> {
  const db = useDatabase()
  const today = new Date()
  const timeBlocks = (await db
    .select()
    .from(tables.timeBlocks)
    .where(eq(tables.timeBlocks.userId, userId))
    .orderBy(asc(tables.timeBlocks.startsAt))) as TimeBlockRecord[]
  const objectives = (await db
    .select()
    .from(tables.objectives)
    .where(eq(tables.objectives.userId, userId))) as ObjectiveRecord[]
  const focusSessions = (await db
    .select()
    .from(tables.focusSessions)
    .where(eq(tables.focusSessions.userId, userId))) as FocusSessionRecord[]

  const todayAgenda = timeBlocks.filter(item => isSameDay(parseISO(item.startsAt), today))
  const openObjectives = objectives.filter(item => item.status !== 'done')
  const finance = await buildFinanceOverview(userId)
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
        value: `${focusSessions.reduce((sum, item) => sum + item.actualMinutes, 0)} min`
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

async function findUser(userId: string) {
  const db = useDatabase()
  const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1)
  return (user as PlannerUserRecord | undefined) || null
}

async function consumeToken(
  table: typeof tables.passwordResetTokens | typeof tables.emailVerificationTokens,
  token: string
) {
  const db = useDatabase()
  const [record] = (await db
    .select()
    .from(table)
    .where(eq(table.tokenHash, hashOpaqueToken(token)))
    .limit(1)) as VerificationTokenRecord[]

  if (!record || record.usedAt || Date.parse(record.expiresAt) < Date.now()) {
    return null
  }

  const usedAt = nowIso()
  await db.update(table).set({ usedAt }).where(eq(table.id, record.id))
  return { ...record, usedAt }
}

async function createToken(
  table: typeof tables.passwordResetTokens | typeof tables.emailVerificationTokens,
  prefix: string,
  userId: string,
  ttlMs: number
) {
  const db = useDatabase()
  const rawToken = createOpaqueToken()
  await db.insert(table).values({
    id: createId(prefix),
    userId,
    tokenHash: hashOpaqueToken(rawToken),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    usedAt: null,
    createdAt: nowIso()
  })
  return rawToken
}

export function usePlannerRepository() {
  return {
    async getBootstrap() {
      const db = useDatabase()
      const config = useRuntimeConfig()
      const users = await db.select().from(tables.users)
      const demoBootstrapEligible = users.length === 1 && users[0]?.email === config.demoUserEmail

      return {
        demoMode: demoBootstrapEligible,
        singleUserMode: config.singleUserMode,
        canRegister: users.length === 0 || demoBootstrapEligible,
        demoCredentials: demoBootstrapEligible
          ? {
              email: config.demoUserEmail,
              password: config.demoUserPassword
            }
          : null
      }
    },

    async countUsers() {
      const db = useDatabase()
      const rows = await db.select({ count: sql<number>`count(*)` }).from(tables.users)
      return Number(rows[0]?.count ?? 0)
    },

    async findUserByEmail(email: string) {
      const db = useDatabase()
      const [user] = await db
        .select()
        .from(tables.users)
        .where(sql`lower(${tables.users.email}) = ${email.toLowerCase()}`)
        .limit(1)
      return (user as PlannerUserRecord | undefined) || null
    },

    async findUserById(userId: string) {
      return findUser(userId)
    },

    async findUserByIdentity(provider: Provider, providerUserId: string) {
      const db = useDatabase()
      const [identity] = await db
        .select()
        .from(tables.authIdentities)
        .where(
          and(
            eq(tables.authIdentities.provider, provider),
            eq(tables.authIdentities.providerUserId, providerUserId)
          )
        )
        .limit(1)

      if (!identity) {
        return null
      }

      return findUser(identity.userId)
    },

    async createUser(input: { email: string; displayName: string; passwordHash: string | null; emailVerified?: boolean }) {
      const db = useDatabase()
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

      await db.insert(tables.users).values(user)
      return user
    },

    async promoteDemoUser(input: { email: string; displayName: string; passwordHash: string }) {
      const db = useDatabase()
      const config = useRuntimeConfig()
      const users = (await db.select().from(tables.users)) as PlannerUserRecord[]
      const user = users[0]

      if (!user || users.length !== 1 || user.email !== config.demoUserEmail) {
        return null
      }

      const patch = {
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        avatarInitials: input.displayName
          .split(' ')
          .map(part => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        passwordHash: input.passwordHash,
        emailVerified: false,
        updatedAt: nowIso()
      }

      await db.update(tables.users).set(patch).where(eq(tables.users.id, user.id))
      return { ...user, ...patch }
    },

    async linkIdentity(userId: string, provider: Provider, providerUserId: string) {
      const db = useDatabase()
      const [exists] = await db
        .select()
        .from(tables.authIdentities)
        .where(
          and(
            eq(tables.authIdentities.userId, userId),
            eq(tables.authIdentities.provider, provider),
            eq(tables.authIdentities.providerUserId, providerUserId)
          )
        )
        .limit(1)

      if (!exists) {
        await db.insert(tables.authIdentities).values({
          id: createId('identity'),
          userId,
          provider,
          providerUserId,
          createdAt: nowIso()
        })
      }
    },

    async updateUserPassword(userId: string, passwordHash: string) {
      const user = await findUser(userId)
      if (!user) {
        return null
      }

      const patch = { passwordHash, updatedAt: nowIso() }
      await useDatabase().update(tables.users).set(patch).where(eq(tables.users.id, userId))
      return { ...user, ...patch }
    },

    async markEmailVerified(userId: string) {
      const user = await findUser(userId)
      if (!user) {
        return null
      }

      const patch = { emailVerified: true, updatedAt: nowIso() }
      await useDatabase().update(tables.users).set(patch).where(eq(tables.users.id, userId))
      return { ...user, ...patch }
    },

    async createPasswordResetToken(userId: string) {
      return createToken(tables.passwordResetTokens, 'reset', userId, 1000 * 60 * 30)
    },

    async consumePasswordResetToken(token: string) {
      return consumeToken(tables.passwordResetTokens, token)
    },

    async createEmailVerificationToken(userId: string) {
      return createToken(tables.emailVerificationTokens, 'verify', userId, 1000 * 60 * 60 * 24)
    },

    async consumeEmailVerificationToken(token: string) {
      return consumeToken(tables.emailVerificationTokens, token)
    },

    async createAuditEvent(userId: string | null, action: string, entity: string, entityId: string | null, context: Record<string, unknown> = {}) {
      await useDatabase().insert(tables.auditEvents).values({
        id: createId('audit'),
        userId,
        action,
        entity,
        entityId,
        context,
        createdAt: nowIso()
      })
    },

    async listObjectives(userId: string) {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.objectives)
        .where(eq(tables.objectives.userId, userId))
        .orderBy(desc(tables.objectives.createdAt))) as ObjectiveRecord[]
    },

    async createObjective(userId: string, input: Omit<ObjectiveRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
      const record: ObjectiveRecord = {
        id: createId('objective'),
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...input
      }
      await useDatabase().insert(tables.objectives).values(record)
      return record
    },

    async updateObjective(userId: string, objectiveId: string, patch: Partial<ObjectiveRecord>) {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.objectives)
        .where(and(eq(tables.objectives.userId, userId), eq(tables.objectives.id, objectiveId)))
        .limit(1)) as ObjectiveRecord[]

      if (!record) {
        return null
      }

      const updated = { ...record, ...patch, updatedAt: nowIso() }
      await db
        .update(tables.objectives)
        .set({ ...patch, updatedAt: updated.updatedAt })
        .where(eq(tables.objectives.id, objectiveId))
      return updated
    },

    async listTimeBlocks(userId: string) {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.timeBlocks)
        .where(eq(tables.timeBlocks.userId, userId))
        .orderBy(asc(tables.timeBlocks.startsAt))) as TimeBlockRecord[]
    },

    async createTimeBlock(userId: string, input: Record<string, unknown>) {
      const record: TimeBlockRecord = {
        id: createId('block'),
        userId,
        objectiveId: (input.objectiveId as string | null) || null,
        title: String(input.title),
        description: String(input.description || ''),
        startsAt: String(input.startsAt),
        endsAt: String(input.endsAt),
        kind: input.kind as TimeBlockRecord['kind'],
        tone: input.tone as TimeBlockRecord['tone'],
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await useDatabase().insert(tables.timeBlocks).values(record)
      return record
    },

    async updateTimeBlock(userId: string, blockId: string, patch: Record<string, unknown>) {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.timeBlocks)
        .where(and(eq(tables.timeBlocks.userId, userId), eq(tables.timeBlocks.id, blockId)))
        .limit(1)) as TimeBlockRecord[]

      if (!record) {
        return null
      }

      const updated = { ...record, ...patch, updatedAt: nowIso() } as TimeBlockRecord
      await db
        .update(tables.timeBlocks)
        .set({ ...patch, updatedAt: updated.updatedAt })
        .where(eq(tables.timeBlocks.id, blockId))
      return updated
    },

    async listFocusSessions(userId: string) {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.focusSessions)
        .where(eq(tables.focusSessions.userId, userId))
        .orderBy(desc(tables.focusSessions.createdAt))) as FocusSessionRecord[]
    },

    async createFocusSession(userId: string, input: Record<string, unknown>) {
      const record: FocusSessionRecord = {
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
      await useDatabase().insert(tables.focusSessions).values(record)
      return record
    },

    async listJournalEntries(userId: string) {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.journalEntries)
        .where(eq(tables.journalEntries.userId, userId))
        .orderBy(desc(tables.journalEntries.createdAt))) as JournalEntryRecord[]
    },

    async createJournalEntry(userId: string, input: Record<string, unknown>) {
      const record: JournalEntryRecord = {
        id: createId('journal'),
        userId,
        title: String(input.title),
        body: String(input.body),
        prompt: String(input.prompt || ''),
        focusTag: String(input.focusTag || 'Reflection'),
        entryDate: (input.entryDate as string | null) || null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await useDatabase().insert(tables.journalEntries).values(record)
      return record
    },

    async updateJournalEntry(userId: string, entryId: string, patch: Record<string, unknown>) {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.journalEntries)
        .where(and(eq(tables.journalEntries.userId, userId), eq(tables.journalEntries.id, entryId)))
        .limit(1)) as JournalEntryRecord[]

      if (!record) {
        return null
      }

      const updated = { ...record, ...patch, updatedAt: nowIso() } as JournalEntryRecord
      await db
        .update(tables.journalEntries)
        .set({ ...patch, updatedAt: updated.updatedAt })
        .where(eq(tables.journalEntries.id, entryId))
      return updated
    },

    async listGoalAreas(userId: string) {
      return buildGoals(userId)
    },

    async createGoalArea(userId: string, input: Record<string, unknown>) {
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
      await useDatabase().insert(tables.goalAreas).values(record)
      return record
    },

    async updateGoalArea(userId: string, goalId: string, patch: Record<string, unknown>) {
      const db = useDatabase()
      const [record] = await db
        .select()
        .from(tables.goalAreas)
        .where(and(eq(tables.goalAreas.userId, userId), eq(tables.goalAreas.id, goalId)))
        .limit(1)

      if (!record) {
        return null
      }

      const updatedAt = nowIso()
      await db
        .update(tables.goalAreas)
        .set({ ...patch, updatedAt })
        .where(eq(tables.goalAreas.id, goalId))
      return { ...record, ...patch, updatedAt }
    },

    async getFinanceOverview(userId: string) {
      return buildFinanceOverview(userId)
    },

    async createFinanceTransaction(userId: string, input: Record<string, unknown>) {
      const db = useDatabase()
      const record: FinanceTransactionRecord = {
        id: createId('txn'),
        userId,
        accountId: String(input.accountId),
        categoryId: String(input.categoryId),
        title: String(input.title),
        amount: Number(input.amount),
        direction: input.direction as FinanceTransactionRecord['direction'],
        status: input.status as FinanceTransactionRecord['status'],
        occurredAt: String(input.occurredAt),
        notes: String(input.notes || ''),
        createdAt: nowIso()
      }

      await db.transaction(async tx => {
        await tx.insert(tables.financeTransactions).values(record)

        const [account] = await tx
          .select()
          .from(tables.financeAccounts)
          .where(and(eq(tables.financeAccounts.userId, userId), eq(tables.financeAccounts.id, record.accountId)))
          .limit(1)

        if (account) {
          const delta = record.direction === 'income' ? record.amount : -record.amount
          await tx
            .update(tables.financeAccounts)
            .set({ balance: account.balance + delta })
            .where(eq(tables.financeAccounts.id, account.id))
        }
      })

      return record
    },

    async getDashboard(userId: string) {
      const user = await findUser(userId)
      if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found.' })
      }

      const db = useDatabase()
      const today = new Date()
      const objectives = (await db
        .select()
        .from(tables.objectives)
        .where(eq(tables.objectives.userId, userId))
        .orderBy(desc(tables.objectives.createdAt))) as ObjectiveRecord[]
      const timeBlocks = (await db
        .select()
        .from(tables.timeBlocks)
        .where(eq(tables.timeBlocks.userId, userId))
        .orderBy(asc(tables.timeBlocks.startsAt))) as TimeBlockRecord[]
      const focusSessions = (await db
        .select()
        .from(tables.focusSessions)
        .where(eq(tables.focusSessions.userId, userId))
        .orderBy(desc(tables.focusSessions.createdAt))) as FocusSessionRecord[]

      const agenda = timeBlocks.filter(item => isSameDay(parseISO(item.startsAt), today))
      const focus = focusSessions.reduce(
        (acc, item) => {
          acc.actualMinutes += item.actualMinutes
          acc.plannedMinutes += item.plannedMinutes
          return acc
        },
        { actualMinutes: 0, plannedMinutes: 0 }
      )
      const completed = objectives.filter(item => item.status === 'done').length
      const completionRate = calculateCompletionRate(objectives.length, completed)

      return {
        greeting: buildGreeting(user.displayName),
        dateLabel: sessionDateLabel(today),
        completionRate,
        agenda,
        objectives,
        focus: {
          ...focus,
          bestWindow: bestFocusWindow(),
          sessions: focusSessions
        },
        finance: await buildFinanceOverview(userId),
        goals: await buildGoals(userId),
        quickJournalPrompt: 'What deserves protection before the day fragments?',
        aiBrief: await buildAiBrief(userId)
      }
    },

    async getAiBrief(userId: string) {
      const brief = await buildAiBrief(userId)
      await useDatabase().insert(tables.aiBriefs).values({
        id: createId('brief'),
        userId,
        kind: 'daily',
        headline: brief.headline,
        summary: brief.summary,
        recommendations: brief.recommendations,
        createdAt: nowIso()
      })
      return brief
    }
  }
}
