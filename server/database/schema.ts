import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarInitials: text('avatar_initials').notNull(),
  role: text('role').notNull().default('owner'),
  emailVerified: boolean('email_verified').notNull().default(false),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const authIdentities = pgTable('auth_identities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const objectives = pgTable('objectives', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  detail: text('detail').notNull(),
  status: text('status').notNull(),
  urgency: text('urgency').notNull(),
  focusWindow: text('focus_window').notNull(),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  objectiveId: text('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  status: text('status').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const timeBlocks = pgTable('time_blocks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  objectiveId: text('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  kind: text('kind').notNull(),
  tone: text('tone').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const focusSessions = pgTable('focus_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  objectiveId: text('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  plannedMinutes: integer('planned_minutes').notNull(),
  actualMinutes: integer('actual_minutes').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
  dayKey: text('day_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const journalEntries = pgTable('journal_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  prompt: text('prompt').notNull(),
  focusTag: text('focus_tag').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const goalAreas = pgTable('goal_areas', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  currentPercent: integer('current_percent').notNull(),
  targetPercent: integer('target_percent').notNull(),
  tone: text('tone').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const goalMilestones = pgTable('goal_milestones', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  goalAreaId: text('goal_area_id').notNull().references(() => goalAreas.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').notNull(),
  targetDate: timestamp('target_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const financeAccounts = pgTable('finance_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  currency: text('currency').notNull(),
  balance: numeric('balance', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const financeCategories = pgTable('finance_categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  icon: text('icon').notNull(),
  budget: numeric('budget', { precision: 14, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const financeTransactions = pgTable('finance_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => financeAccounts.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => financeCategories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  direction: text('direction').notNull(),
  status: text('status').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  notes: text('notes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const monthlyTargets = pgTable('monthly_targets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  monthKey: text('month_key').notNull(),
  spendingLimit: numeric('spending_limit', { precision: 14, scale: 2 }).notNull(),
  savingsTarget: numeric('savings_target', { precision: 14, scale: 2 }).notNull(),
  incomeTarget: numeric('income_target', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const aiBriefs = pgTable('ai_briefs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  headline: text('headline').notNull(),
  summary: text('summary').notNull(),
  recommendations: jsonb('recommendations').$type<string[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const auditEvents = pgTable('audit_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})
