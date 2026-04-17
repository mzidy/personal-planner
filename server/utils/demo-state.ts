import type {
  AiBriefRecord,
  AuthIdentityRecord,
  AuditEventRecord,
  FinanceAccountRecord,
  FinanceCategoryRecord,
  FinanceTransactionRecord,
  FocusSessionRecord,
  GoalAreaRecord,
  GoalMilestoneRecord,
  JournalEntryRecord,
  MonthlyTargetRecord,
  ObjectiveRecord,
  PlannerState,
  PlannerUserRecord,
  TaskRecord,
  TimeBlockRecord
} from '~~/shared/types/planner'
import { createId } from '~~/server/utils/id'

function initialsFromName(name: string) {
  return name
    .split(' ')
    .map(part => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export async function createDemoState(email: string, password: string): Promise<PlannerState> {
  const now = new Date('2026-04-16T08:00:00.000Z')
  const iso = (value: string) => new Date(value).toISOString()
  const userId = createId('user')
  const accountPrimaryId = createId('account')
  const accountInvestmentId = createId('account')
  const categoryDiningId = createId('category')
  const categoryTravelId = createId('category')
  const categoryIncomeId = createId('category')
  const categoryInfrastructureId = createId('category')
  const goalWealthId = createId('goal')
  const goalTravelId = createId('goal')
  const objectiveDeckId = createId('objective')
  const objectivePortfolioId = createId('objective')
  const objectiveDinnerId = createId('objective')

  const user: PlannerUserRecord = {
    id: userId,
    email,
    displayName: 'Julian Sterling',
    avatarInitials: initialsFromName('Julian Sterling'),
    role: 'owner',
    emailVerified: true,
    passwordHash: await hashPassword(password),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }

  const objectives: ObjectiveRecord[] = [
    {
      id: objectiveDeckId,
      userId,
      title: 'Finalize Q4 strategy deck',
      detail: 'Lock the narrative, financial appendix, and board framing for next week.',
      status: 'focus',
      urgency: 'critical',
      focusWindow: '07:00 - 10:00',
      scheduledFor: iso('2026-04-16T09:00:00.000Z'),
      dueDate: iso('2026-04-16T17:00:00.000Z'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: objectivePortfolioId,
      userId,
      title: 'Review portfolio performance',
      detail: 'Reconcile discretionary spend versus the Zurich fund allocation.',
      status: 'scheduled',
      urgency: 'high',
      focusWindow: '12:30 - 13:15',
      scheduledFor: iso('2026-04-16T12:30:00.000Z'),
      dueDate: iso('2026-04-17T15:00:00.000Z'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: objectiveDinnerId,
      userId,
      title: 'Confirm anniversary dinner',
      detail: 'Finalize venue, guest list, and travel transfers for tomorrow evening.',
      status: 'delegated',
      urgency: 'medium',
      focusWindow: 'Evening',
      scheduledFor: null,
      dueDate: iso('2026-04-17T18:00:00.000Z'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ]

  const tasks: TaskRecord[] = [
    {
      id: createId('task'),
      userId,
      objectiveId: objectiveDeckId,
      title: 'Refresh board metrics appendix',
      status: 'doing',
      dueDate: iso('2026-04-16T10:30:00.000Z'),
      createdAt: now.toISOString()
    },
    {
      id: createId('task'),
      userId,
      objectiveId: objectivePortfolioId,
      title: 'Validate April spend categories',
      status: 'todo',
      dueDate: iso('2026-04-16T14:00:00.000Z'),
      createdAt: now.toISOString()
    }
  ]

  const timeBlocks: TimeBlockRecord[] = [
    {
      id: createId('block'),
      userId,
      objectiveId: objectiveDeckId,
      title: 'Executive board review',
      description: 'Quarterly performance analysis and future fiscal planning.',
      startsAt: iso('2026-04-16T09:00:00.000Z'),
      endsAt: iso('2026-04-16T10:00:00.000Z'),
      kind: 'meeting',
      tone: 'ink',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: createId('block'),
      userId,
      objectiveId: objectivePortfolioId,
      title: 'Luncheon with venture partners',
      description: 'Series C discussion and Zurich travel alignment.',
      startsAt: iso('2026-04-16T12:30:00.000Z'),
      endsAt: iso('2026-04-16T13:30:00.000Z'),
      kind: 'meeting',
      tone: 'teal',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: createId('block'),
      userId,
      objectiveId: objectiveDeckId,
      title: 'Deep work: strategic narrative',
      description: 'Quiet drafting block for the opening story and recommendation slide.',
      startsAt: iso('2026-04-16T15:00:00.000Z'),
      endsAt: iso('2026-04-16T16:30:00.000Z'),
      kind: 'focus',
      tone: 'mist',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: createId('block'),
      userId,
      objectiveId: null,
      title: 'Zurich travel handoff',
      description: 'Confirm hotel, dinner transfer, and passport pouch.',
      startsAt: iso('2026-04-17T08:00:00.000Z'),
      endsAt: iso('2026-04-17T08:45:00.000Z'),
      kind: 'travel',
      tone: 'teal',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ]

  const focusSessions: FocusSessionRecord[] = [
    {
      id: createId('focus'),
      userId,
      objectiveId: objectiveDeckId,
      title: 'Board memo drafting',
      plannedMinutes: 90,
      actualMinutes: 84,
      startedAt: iso('2026-04-16T06:45:00.000Z'),
      endedAt: iso('2026-04-16T08:09:00.000Z'),
      dayKey: '2026-04-16',
      createdAt: now.toISOString()
    },
    {
      id: createId('focus'),
      userId,
      objectiveId: objectivePortfolioId,
      title: 'Portfolio reconciliation',
      plannedMinutes: 45,
      actualMinutes: 38,
      startedAt: iso('2026-04-15T07:00:00.000Z'),
      endedAt: iso('2026-04-15T07:38:00.000Z'),
      dayKey: '2026-04-15',
      createdAt: now.toISOString()
    }
  ]

  const journalEntries: JournalEntryRecord[] = [
    {
      id: createId('journal'),
      userId,
      title: 'Morning reflections on strategy',
      body:
        'The quiet hours of the morning are still the clearest point in the day. The deck is finally moving from observation to conviction, which means the next step is simplification, not more content.',
      prompt: 'What decision today protects long-term momentum?',
      focusTag: 'Focused',
      createdAt: iso('2026-04-16T06:20:00.000Z'),
      updatedAt: iso('2026-04-16T06:20:00.000Z')
    },
    {
      id: createId('journal'),
      userId,
      title: 'Evening wind-down',
      body:
        'The transition between tasks was cleaner than yesterday, largely because the calendar finally reflected real energy instead of idealized commitments.',
      prompt: 'What should be removed tomorrow?',
      focusTag: 'Review',
      createdAt: iso('2026-04-15T19:12:00.000Z'),
      updatedAt: iso('2026-04-15T19:12:00.000Z')
    }
  ]

  const goalAreas: GoalAreaRecord[] = [
    {
      id: goalWealthId,
      userId,
      title: 'Wealth growth',
      summary: 'Stay ahead of the annual savings target while keeping discretionary spending deliberate.',
      currentPercent: 65,
      targetPercent: 100,
      tone: 'ink',
      dueDate: iso('2026-12-31T12:00:00.000Z'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    },
    {
      id: goalTravelId,
      userId,
      title: 'Travel architecture',
      summary: 'Design travel around recovery instead of compression.',
      currentPercent: 46,
      targetPercent: 100,
      tone: 'teal',
      dueDate: iso('2026-10-01T12:00:00.000Z'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ]

  const goalMilestones: GoalMilestoneRecord[] = [
    {
      id: createId('milestone'),
      userId,
      goalAreaId: goalWealthId,
      title: 'Reach April savings checkpoint',
      status: 'completed',
      targetDate: iso('2026-04-30T12:00:00.000Z'),
      createdAt: now.toISOString()
    },
    {
      id: createId('milestone'),
      userId,
      goalAreaId: goalTravelId,
      title: 'Finalize Zurich itinerary standards',
      status: 'active',
      targetDate: iso('2026-04-20T12:00:00.000Z'),
      createdAt: now.toISOString()
    }
  ]

  const financeAccounts: FinanceAccountRecord[] = [
    {
      id: accountPrimaryId,
      userId,
      name: 'Executive checking',
      type: 'checking',
      currency: 'USD',
      balance: 18240,
      createdAt: now.toISOString()
    },
    {
      id: accountInvestmentId,
      userId,
      name: 'Zurich growth fund',
      type: 'investment',
      currency: 'USD',
      balance: 1402260,
      createdAt: now.toISOString()
    }
  ]

  const financeCategories: FinanceCategoryRecord[] = [
    {
      id: categoryDiningId,
      userId,
      name: 'Fine dining',
      type: 'expense',
      icon: 'utensils-crossed',
      budget: 4000,
      createdAt: now.toISOString()
    },
    {
      id: categoryTravelId,
      userId,
      name: 'Travel',
      type: 'expense',
      icon: 'plane',
      budget: 6000,
      createdAt: now.toISOString()
    },
    {
      id: categoryInfrastructureId,
      userId,
      name: 'Infrastructure',
      type: 'expense',
      icon: 'server',
      budget: 3000,
      createdAt: now.toISOString()
    },
    {
      id: categoryIncomeId,
      userId,
      name: 'Capital income',
      type: 'income',
      icon: 'banknote',
      budget: null,
      createdAt: now.toISOString()
    }
  ]

  const financeTransactions: FinanceTransactionRecord[] = [
    {
      id: createId('txn'),
      userId,
      accountId: accountPrimaryId,
      categoryId: categoryInfrastructureId,
      title: 'Cloud infrastructure service',
      amount: 840,
      direction: 'expense',
      status: 'verified',
      occurredAt: iso('2026-04-16T09:45:00.000Z'),
      notes: 'AI workspace subscription',
      createdAt: now.toISOString()
    },
    {
      id: createId('txn'),
      userId,
      accountId: accountPrimaryId,
      categoryId: categoryTravelId,
      title: 'Maison de Luxe hotel deposit',
      amount: 2100,
      direction: 'expense',
      status: 'verified',
      occurredAt: iso('2026-04-15T12:00:00.000Z'),
      notes: 'Zurich weekend lodging',
      createdAt: now.toISOString()
    },
    {
      id: createId('txn'),
      userId,
      accountId: accountInvestmentId,
      categoryId: categoryIncomeId,
      title: 'Dividend yield reinvestment',
      amount: 4250,
      direction: 'income',
      status: 'verified',
      occurredAt: iso('2026-04-12T15:00:00.000Z'),
      notes: 'Settled to investment account',
      createdAt: now.toISOString()
    }
  ]

  const monthlyTargets: MonthlyTargetRecord[] = [
    {
      id: createId('target'),
      userId,
      monthKey: '2026-04',
      spendingLimit: 18000,
      savingsTarget: 12000,
      incomeTarget: 22000,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  ]

  const aiBriefs: AiBriefRecord[] = [
    {
      id: createId('brief'),
      userId,
      kind: 'daily',
      headline: 'Calm command for the afternoon.',
      summary:
        'You are ahead on deep work, within your spending threshold, and carrying one critical objective into the 15:00 focus block.',
      recommendations: [
        'Protect the 15:00 focus block from new meetings.',
        'Resolve the portfolio review before any new discretionary spend.'
      ],
      createdAt: now.toISOString()
    }
  ]

  const auditEvents: AuditEventRecord[] = []
  const authIdentities: AuthIdentityRecord[] = []

  return {
    users: [user],
    authIdentities,
    emailVerificationTokens: [],
    passwordResetTokens: [],
    objectives,
    tasks,
    timeBlocks,
    focusSessions,
    journalEntries,
    goalAreas,
    goalMilestones,
    financeAccounts,
    financeCategories,
    financeTransactions,
    monthlyTargets,
    aiBriefs,
    auditEvents
  }
}
