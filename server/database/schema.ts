import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Timestamps are stored as ISO 8601 text to match the string-based domain records.

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarInitials: text('avatar_initials').notNull(),
  role: text('role').notNull().default('owner'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  passwordHash: text('password_hash'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const authIdentities = sqliteTable('auth_identities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  createdAt: text('created_at').notNull()
})

export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull()
})

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull()
})

export const objectives = sqliteTable('objectives', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  detail: text('detail').notNull(),
  status: text('status').notNull(),
  urgency: text('urgency').notNull(),
  focusWindow: text('focus_window').notNull(),
  scheduledFor: text('scheduled_for'),
  dueDate: text('due_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  objectiveId: text('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  status: text('status').notNull(),
  dueDate: text('due_date'),
  createdAt: text('created_at').notNull()
})

export const timeBlocks = sqliteTable('time_blocks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  objectiveId: text('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at').notNull(),
  kind: text('kind').notNull(),
  tone: text('tone').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const focusSessions = sqliteTable('focus_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  objectiveId: text('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  plannedMinutes: integer('planned_minutes').notNull(),
  actualMinutes: integer('actual_minutes').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at').notNull(),
  dayKey: text('day_key').notNull(),
  createdAt: text('created_at').notNull()
})

export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  prompt: text('prompt').notNull(),
  focusTag: text('focus_tag').notNull(),
  entryDate: text('entry_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const goalAreas = sqliteTable('goal_areas', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  currentPercent: integer('current_percent').notNull(),
  targetPercent: integer('target_percent').notNull(),
  tone: text('tone').notNull(),
  dueDate: text('due_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const goalMilestones = sqliteTable('goal_milestones', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  goalAreaId: text('goal_area_id').notNull().references(() => goalAreas.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').notNull(),
  targetDate: text('target_date'),
  createdAt: text('created_at').notNull()
})

export const financeAccounts = sqliteTable('finance_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  currency: text('currency').notNull(),
  balance: real('balance').notNull(),
  createdAt: text('created_at').notNull()
})

export const financeCategories = sqliteTable('finance_categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  icon: text('icon').notNull(),
  budget: real('budget'),
  createdAt: text('created_at').notNull()
})

export const financeTransactions = sqliteTable('finance_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => financeAccounts.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => financeCategories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amount: real('amount').notNull(),
  direction: text('direction').notNull(),
  status: text('status').notNull(),
  occurredAt: text('occurred_at').notNull(),
  notes: text('notes').notNull(),
  createdAt: text('created_at').notNull()
})

export const monthlyTargets = sqliteTable('monthly_targets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  monthKey: text('month_key').notNull(),
  spendingLimit: real('spending_limit').notNull(),
  savingsTarget: real('savings_target').notNull(),
  incomeTarget: real('income_target').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const aiBriefs = sqliteTable('ai_briefs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  headline: text('headline').notNull(),
  summary: text('summary').notNull(),
  recommendations: text('recommendations', { mode: 'json' }).$type<string[]>().notNull(),
  createdAt: text('created_at').notNull()
})

export const learningTopics = sqliteTable('learning_topics', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  focus: text('focus').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const learningMessages = sqliteTable('learning_messages', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull().references(() => learningTopics.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull()
})

export const statsProfiles = sqliteTable(
  'stats_profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    heightCm: real('height_cm'),
    targetWeightKg: real('target_weight_kg'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  table => [uniqueIndex('stats_profiles_user').on(table.userId)]
)

export const weighIns = sqliteTable(
  'weigh_ins',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    weekKey: text('week_key').notNull(),
    weightKg: real('weight_kg').notNull(),
    bodyFatPercent: real('body_fat_percent'),
    notes: text('notes').notNull().default(''),
    measuredAt: text('measured_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  table => [uniqueIndex('weigh_ins_user_week').on(table.userId, table.weekKey)]
)

export const shoppingItems = sqliteTable('shopping_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  horizon: text('horizon').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  price: real('price'),
  bought: integer('bought', { mode: 'boolean' }).notNull().default(false),
  boughtAt: text('bought_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const investmentPositions = sqliteTable('investment_positions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull().default(''),
  quantity: real('quantity').notNull(),
  unitCost: real('unit_cost').notNull(),
  currentPrice: real('current_price'),
  currency: text('currency').notNull().default('USD'),
  notes: text('notes').notNull().default(''),
  openedAt: text('opened_at'),
  // Options only
  optionType: text('option_type'),
  strike: real('strike'),
  expiry: text('expiry'),
  contractSize: real('contract_size'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  context: text('context', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: text('created_at').notNull()
})
