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

/**
 * A Claudemy course: a topic researched on the web and turned into short
 * two-host lessons. The pipeline runs one bounded step per request, so every
 * intermediate result (sub-topics, themes, plan) is kept here between steps.
 */
export const claudemyCourses = sqliteTable('claudemy_courses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull(),
  level: text('level').notNull().default('beginner'),
  lessonCount: integer('lesson_count').notNull().default(12),
  person: text('person').notNull().default(''),
  stage: text('stage').notNull().default('mapping'),
  error: text('error').notNull().default(''),
  /** Set while a step runs, so a second tab cannot run the same step twice. */
  stepStartedAt: text('step_started_at'),
  sourcingRound: integer('sourcing_round').notNull().default(0),
  /** Index of the next sub-topic to search for in the first sourcing round. */
  sourcingCursor: integer('sourcing_cursor').notNull().default(0),
  subtopics: text('subtopics', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  themes: text('themes', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  splits: text('splits', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  gaps: text('gaps', { mode: 'json' }).$type<string[]>().notNull().default([]),
  arcs: text('arcs', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  disagreements: text('disagreements', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  stories: text('stories', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  feedback: text('feedback').notNull().default(''),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  webSearches: integer('web_searches').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

/** One page on a course's reading list, and the notes a reader took from it. */
export const claudemyPages = sqliteTable(
  'claudemy_pages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    courseId: text('course_id').notNull().references(() => claudemyCourses.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull().default(''),
    kind: text('kind').notNull().default(''),
    subtopics: text('subtopics', { mode: 'json' }).$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('pending'),
    failReason: text('fail_reason').notNull().default(''),
    words: integer('words').notNull().default(0),
    /** Readable text of the page, for private study only; never republished. */
    content: text('content').notNull().default(''),
    readAt: text('read_at'),
    skipReason: text('skip_reason').notNull().default(''),
    notes: text('notes', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    createdAt: text('created_at').notNull()
  },
  table => [uniqueIndex('claudemy_pages_course_seq').on(table.courseId, table.seq)]
)

export const claudemyLessons = sqliteTable(
  'claudemy_lessons',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    courseId: text('course_id').notNull().references(() => claudemyCourses.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    arc: integer('arc').notNull().default(0),
    handle: text('handle').notNull(),
    status: text('status').notNull().default('planned'),
    plan: text('plan', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    script: text('script', { mode: 'json' }).$type<unknown[] | null>(),
    card: text('card', { mode: 'json' }).$type<Record<string, unknown> | null>(),
    words: integer('words').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),
    problems: text('problems', { mode: 'json' }).$type<string[]>().notNull().default([]),
    heardAt: text('heard_at'),
    triedAt: text('tried_at'),
    ruleKept: integer('rule_kept', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  table => [uniqueIndex('claudemy_lessons_course_number').on(table.courseId, table.number)]
)

export const statsProfiles = sqliteTable(
  'stats_profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    heightCm: real('height_cm'),
    targetWeightKg: real('target_weight_kg'),
    // Asked at registration; both optional, and editable under Personal stats.
    gender: text('gender'),
    birthDate: text('birth_date'),
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

/**
 * A routine item as a recurring definition: it exists every day rather than on
 * the single day it was typed. Archiving retires it from future days while
 * leaving its recorded history intact.
 */
export const routineTemplates = sqliteTable('routine_templates', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  position: integer('position').notNull().default(0),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

/** One row per routine item per day — absence means the day is still 'planned'. */
export const routineDayStates = sqliteTable(
  'routine_day_states',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    templateId: text('template_id')
      .notNull()
      .references(() => routineTemplates.id, { onDelete: 'cascade' }),
    entryDate: text('entry_date').notNull(),
    state: text('state').notNull().default('planned'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  table => [uniqueIndex('routine_day_states_unique').on(table.userId, table.templateId, table.entryDate)]
)

// Superseded by routineTemplates + routineDayStates; retained until its data is migrated.
export const routineEntries = sqliteTable('routine_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  // Date-only (YYYY-MM-DD): the day the entry belongs to, which is what history groups by.
  entryDate: text('entry_date').notNull(),
  state: text('state').notNull().default('planned'),
  // Manual order within a day. Legacy rows share 0 and are normalised on first move.
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

/** An investing rule the portfolio is meant to be held against. */
export const portfolioRules = sqliteTable('portfolio_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  // Date-only (YYYY-MM-DD): when the rule was put in place.
  dateSet: text('date_set').notNull(),
  isIndex: integer('is_index', { mode: 'boolean' }).notNull().default(false),
  geo: text('geo').notNull().default(''),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

/**
 * A saved ticker review. The metric snapshot is kept alongside the verdict so
 * an old review still shows the numbers it was actually based on — re-fetching
 * today's prices would quietly rewrite history.
 */
export const tickerReviews = sqliteTable('ticker_reviews', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  companyName: text('company_name').notNull().default(''),
  technical: text('technical', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  fundamental: text('fundamental', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  /** Narrative written by Claude; empty when no API key is configured. */
  review: text('review').notNull().default(''),
  /** Set when the narrative could not be generated, so the UI can explain why. */
  reviewError: text('review_error').notNull().default(''),
  createdAt: text('created_at').notNull()
})

/**
 * One answer per Personal Growth prompt. The step key comes from
 * shared/utils/growth-steps.ts; a row exists only once something is written.
 */
export const growthAnswers = sqliteTable(
  'growth_answers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    answer: text('answer').notNull().default(''),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  table => [uniqueIndex('growth_answers_unique').on(table.userId, table.stepKey)]
)

/**
 * A habit designed through the Habit guide wizard. Answers are keyed by the
 * field keys in shared/utils/habit-wizard.ts, so adding a step to the wizard
 * needs no migration.
 */
export const habitPlans = sqliteTable('habit_plans', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default(''),
  answers: text('answers', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
  /** draft while the wizard is being worked through, active once committed to. */
  status: text('status').notNull().default('draft'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

/**
 * A free-text note. Notes imported from an image keep only the extracted text —
 * the image itself is never uploaded or stored, it is read in the browser.
 */
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  /** 'manual' when typed, 'import' when read out of an image. */
  source: text('source').notNull().default('manual'),
  /** The original file name, kept only as a label for an imported note. */
  sourceName: text('source_name').notNull().default(''),
  /**
   * Rows of cells when the note was recognised as a table, null otherwise.
   * `body` always holds a readable text version, so nothing depends on this.
   */
  tableRows: text('table_rows', { mode: 'json' }).$type<string[][] | null>(),
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

/**
 * A linked smart home account (for now only Roborock, logged in by emailed
 * code). `credentials` is the session Roborock returned, sealed with
 * server/utils/secret-box.ts; the account password is never stored.
 */
export const smartHomeAccounts = sqliteTable(
  'smart_home_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('roborock'),
    email: text('email').notNull(),
    baseUrl: text('base_url').notNull(),
    country: text('country').notNull().default(''),
    countryCode: text('country_code').notNull().default(''),
    /** Random value behind Roborock's header_clientid; the code request and the login must share it. */
    clientIdentifier: text('client_identifier').notNull(),
    credentials: text('credentials'),
    /** 'awaiting_code' after a code was sent, 'connected' once logged in. */
    status: text('status').notNull().default('awaiting_code'),
    connectedAt: text('connected_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  table => [uniqueIndex('smart_home_accounts_user_provider').on(table.userId, table.provider)]
)

export const smartHomeDevices = sqliteTable(
  'smart_home_devices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull().references(() => smartHomeAccounts.id, { onDelete: 'cascade' }),
    /** Roborock's device id. */
    duid: text('duid').notNull(),
    name: text('name').notNull(),
    model: text('model').notNull().default(''),
    productName: text('product_name').notNull().default(''),
    protocolVersion: text('protocol_version').notNull().default('1.0'),
    /** The device's local key, sealed like the account credentials. */
    localKey: text('local_key').notNull(),
    online: integer('online', { mode: 'boolean' }).notNull().default(true),
    lastStatus: text('last_status', { mode: 'json' }).$type<Record<string, unknown> | null>(),
    lastStatusAt: text('last_status_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  table => [uniqueIndex('smart_home_devices_account_duid').on(table.accountId, table.duid)]
)

/** Tickers the user follows on Finance → Investing, in their chosen order. Quotes are fetched live, not stored. */
export const watchlistItems = sqliteTable(
  'watchlist_items',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull()
  },
  table => [uniqueIndex('watchlist_items_user_symbol').on(table.userId, table.symbol)]
)

// Active trades (Finance → Active trades). Prices are in each stock's own
// currency, which is recorded with the name when the row is saved.
export const stockExchanges = sqliteTable('stock_exchanges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  soldSymbol: text('sold_symbol').notNull(),
  soldName: text('sold_name').notNull(),
  soldCurrency: text('sold_currency').notNull(),
  soldPrice: real('sold_price').notNull(),
  soldDate: text('sold_date').notNull(),
  soldQuantity: real('sold_quantity').notNull(),
  boughtSymbol: text('bought_symbol').notNull(),
  boughtName: text('bought_name').notNull(),
  boughtCurrency: text('bought_currency').notNull(),
  boughtPrice: real('bought_price').notNull(),
  boughtDate: text('bought_date').notNull(),
  boughtQuantity: real('bought_quantity').notNull(),
  note: text('note').notNull().default(''),
  closedDate: text('closed_date'),
  closedBoughtPrice: real('closed_bought_price'),
  closedSoldPrice: real('closed_sold_price'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const stockTrades = sqliteTable('stock_trades', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  quantity: real('quantity').notNull(),
  entryPrice: real('entry_price').notNull(),
  entryDate: text('entry_date').notNull(),
  targetPrice: real('target_price'),
  stopPrice: real('stop_price'),
  note: text('note').notNull().default(''),
  exitPrice: real('exit_price'),
  exitDate: text('exit_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// One savings goal per user, shown on the teen home pages ("Skateboard fund").
export const savingsGoals = sqliteTable(
  'savings_goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    targetAmount: real('target_amount').notNull(),
    savedAmount: real('saved_amount').notNull().default(0),
    weeklyAllowance: real('weekly_allowance'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  table => [uniqueIndex('savings_goals_user').on(table.userId)]
)
