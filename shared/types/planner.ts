export type Provider = 'password' | 'google'
export type ObjectiveStatus = 'focus' | 'scheduled' | 'delegated' | 'backlog' | 'done'
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low'
export type BlockKind = 'meeting' | 'focus' | 'travel' | 'admin'
export type GoalMilestoneStatus = 'planned' | 'active' | 'completed'
export type FinanceDirection = 'income' | 'expense'
export type FinanceAccountType = 'cash' | 'checking' | 'savings' | 'investment'
export type FinanceTransactionStatus = 'pending' | 'verified'

export interface PlannerUserRecord {
  id: string
  email: string
  displayName: string
  avatarInitials: string
  role: 'owner'
  emailVerified: boolean
  passwordHash: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthIdentityRecord {
  id: string
  userId: string
  provider: Provider
  providerUserId: string
  createdAt: string
}

export interface VerificationTokenRecord {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
  usedAt: string | null
  createdAt: string
}

export interface ObjectiveRecord {
  id: string
  userId: string
  title: string
  detail: string
  status: ObjectiveStatus
  urgency: UrgencyLevel
  focusWindow: string
  scheduledFor: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskRecord {
  id: string
  userId: string
  objectiveId: string | null
  title: string
  status: 'todo' | 'doing' | 'done'
  dueDate: string | null
  createdAt: string
}

export interface TimeBlockRecord {
  id: string
  userId: string
  objectiveId: string | null
  title: string
  description: string
  startsAt: string
  endsAt: string
  kind: BlockKind
  tone: 'ink' | 'teal' | 'mist'
  createdAt: string
  updatedAt: string
}

export interface FocusSessionRecord {
  id: string
  userId: string
  objectiveId: string | null
  title: string
  plannedMinutes: number
  actualMinutes: number
  startedAt: string
  endedAt: string
  dayKey: string
  createdAt: string
}

export interface JournalEntryRecord {
  id: string
  userId: string
  title: string
  body: string
  prompt: string
  focusTag: string
  createdAt: string
  updatedAt: string
}

export interface GoalAreaRecord {
  id: string
  userId: string
  title: string
  summary: string
  currentPercent: number
  targetPercent: number
  tone: 'ink' | 'teal' | 'mist'
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface GoalMilestoneRecord {
  id: string
  userId: string
  goalAreaId: string
  title: string
  status: GoalMilestoneStatus
  targetDate: string | null
  createdAt: string
}

export interface FinanceAccountRecord {
  id: string
  userId: string
  name: string
  type: FinanceAccountType
  currency: string
  balance: number
  createdAt: string
}

export interface FinanceCategoryRecord {
  id: string
  userId: string
  name: string
  type: FinanceDirection
  icon: string
  budget: number | null
  createdAt: string
}

export interface FinanceTransactionRecord {
  id: string
  userId: string
  accountId: string
  categoryId: string
  title: string
  amount: number
  direction: FinanceDirection
  status: FinanceTransactionStatus
  occurredAt: string
  notes: string
  createdAt: string
}

export interface MonthlyTargetRecord {
  id: string
  userId: string
  monthKey: string
  spendingLimit: number
  savingsTarget: number
  incomeTarget: number
  createdAt: string
  updatedAt: string
}

export interface AiBriefRecord {
  id: string
  userId: string
  kind: 'daily' | 'finance' | 'focus'
  headline: string
  summary: string
  recommendations: string[]
  createdAt: string
}

export interface AuditEventRecord {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  context: Record<string, unknown>
  createdAt: string
}

export interface GoalAreaWithMilestones extends GoalAreaRecord {
  milestones: GoalMilestoneRecord[]
}

export interface FinanceOverview {
  netWorth: number
  monthlySpend: number
  monthlyIncome: number
  savingsRate: number
  budgetHealth: number
  target: MonthlyTargetRecord | null
  accounts: FinanceAccountRecord[]
  categories: FinanceCategoryRecord[]
  transactions: FinanceTransactionRecord[]
}

export interface AiBriefPayload {
  headline: string
  summary: string
  recommendations: string[]
  metrics: {
    label: string
    value: string
  }[]
}

export interface DashboardPayload {
  greeting: string
  dateLabel: string
  completionRate: number
  agenda: TimeBlockRecord[]
  objectives: ObjectiveRecord[]
  focus: {
    actualMinutes: number
    plannedMinutes: number
    bestWindow: string
    sessions: FocusSessionRecord[]
  }
  finance: FinanceOverview
  goals: GoalAreaWithMilestones[]
  quickJournalPrompt: string
  aiBrief: AiBriefPayload
}

export interface PlannerState {
  users: PlannerUserRecord[]
  authIdentities: AuthIdentityRecord[]
  emailVerificationTokens: VerificationTokenRecord[]
  passwordResetTokens: VerificationTokenRecord[]
  objectives: ObjectiveRecord[]
  tasks: TaskRecord[]
  timeBlocks: TimeBlockRecord[]
  focusSessions: FocusSessionRecord[]
  journalEntries: JournalEntryRecord[]
  goalAreas: GoalAreaRecord[]
  goalMilestones: GoalMilestoneRecord[]
  financeAccounts: FinanceAccountRecord[]
  financeCategories: FinanceCategoryRecord[]
  financeTransactions: FinanceTransactionRecord[]
  monthlyTargets: MonthlyTargetRecord[]
  aiBriefs: AiBriefRecord[]
  auditEvents: AuditEventRecord[]
}
