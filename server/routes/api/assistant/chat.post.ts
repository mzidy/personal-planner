import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { CLAUDE_MODEL, useAnthropic } from '~~/server/utils/anthropic-client'
import {
  financeTransactionSchema,
  goalAreaSchema,
  journalEntrySchema,
  objectiveSchema,
  timeBlockSchema
} from '~~/shared/schemas/planner'

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000)
      })
    )
    .min(1)
    .max(40)
})

const tools: Anthropic.Tool[] = [
  {
    name: 'create_goal',
    description:
      'Create a yearly goal area for the user. Required: title, a one-sentence summary, currentPercent (progress so far, 0-100; use 0 for a new goal) and targetPercent (usually 100). Ask the user before guessing essential details.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short goal title, 3-120 chars' },
        summary: { type: 'string', description: 'One-sentence summary of the goal, 3-240 chars' },
        currentPercent: { type: 'integer', minimum: 0, maximum: 100 },
        targetPercent: { type: 'integer', minimum: 0, maximum: 100 },
        tone: { type: 'string', enum: ['ink', 'teal', 'mist'], description: 'Visual tone; pick any if user does not care' },
        dueDate: { type: ['string', 'null'], description: 'ISO 8601 UTC datetime, e.g. 2026-12-31T12:00:00Z, or null' }
      },
      required: ['title', 'summary', 'currentPercent', 'targetPercent']
    }
  },
  {
    name: 'create_objective',
    description:
      'Create an objective (priority/task) on the Priorities board. Status lanes: focus = immediate action, scheduled = strategic growth, indoor/outdoor = context lanes, backlog = later, done = completed.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '3-120 chars' },
        detail: { type: 'string', description: 'Scope and why it matters, 3-400 chars' },
        status: { type: 'string', enum: ['focus', 'scheduled', 'indoor', 'outdoor', 'delegated', 'backlog', 'done'] },
        urgency: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        focusWindow: { type: 'string', description: 'When to work on it, e.g. "Morning deep work" or "07:00 - 10:00"' },
        scheduledFor: { type: ['string', 'null'], description: 'ISO 8601 UTC datetime or null' },
        dueDate: { type: ['string', 'null'], description: 'ISO 8601 UTC datetime or null' }
      },
      required: ['title', 'detail']
    }
  },
  {
    name: 'create_journal_entry',
    description: 'Create a diary/journal entry. Body must be at least 10 characters.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '3-120 chars' },
        body: { type: 'string', description: 'The reflection text, 10-6000 chars' },
        prompt: { type: 'string', description: 'Optional prompt the entry answers' },
        focusTag: { type: 'string', description: 'Optional tag, e.g. Focused, Review, Reflection' }
      },
      required: ['title', 'body']
    }
  },
  {
    name: 'create_time_block',
    description:
      'Create a calendar time block. startsAt and endsAt are required ISO 8601 UTC datetimes — ask the user for the date and time if not given.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '3-120 chars' },
        description: { type: 'string', description: 'Optional, up to 240 chars' },
        startsAt: { type: 'string', description: 'ISO 8601 UTC datetime, e.g. 2026-07-30T09:00:00Z' },
        endsAt: { type: 'string', description: 'ISO 8601 UTC datetime, must be after startsAt' },
        kind: { type: 'string', enum: ['meeting', 'focus', 'travel', 'admin'] },
        tone: { type: 'string', enum: ['ink', 'teal', 'mist'] }
      },
      required: ['title', 'startsAt', 'endsAt']
    }
  },
  {
    name: 'get_finance_options',
    description:
      'List the user finance accounts and categories with their ids. Call this before create_finance_transaction to resolve accountId and categoryId.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'create_finance_transaction',
    description:
      'Record a finance transaction. accountId and categoryId must be real ids obtained from get_finance_options. Amount is positive; direction expense or income.',
    input_schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        categoryId: { type: 'string' },
        title: { type: 'string', description: '3-120 chars' },
        amount: { type: 'number', exclusiveMinimum: 0 },
        direction: { type: 'string', enum: ['income', 'expense'] },
        status: { type: 'string', enum: ['pending', 'verified'] },
        occurredAt: { type: 'string', description: 'ISO 8601 UTC datetime' },
        notes: { type: 'string', description: 'Optional, up to 240 chars' }
      },
      required: ['accountId', 'categoryId', 'title', 'amount', 'direction', 'occurredAt']
    }
  }
]

interface CreatedAction {
  type: string
  title: string
}

async function executeTool(
  userId: string,
  name: string,
  input: unknown,
  created: CreatedAction[]
): Promise<string> {
  const repository = usePlannerRepository()

  if (name === 'create_goal') {
    const parsed = goalAreaSchema.parse(input)
    const record = await repository.createGoalArea(userId, { ...parsed, dueDate: parsed.dueDate || null })
    await repository.createAuditEvent(userId, 'create', 'goal', record.id, { title: record.title, via: 'assistant' })
    created.push({ type: 'goal', title: record.title })
    return JSON.stringify({ ok: true, id: record.id, title: record.title })
  }

  if (name === 'create_objective') {
    const parsed = objectiveSchema.parse(input)
    const record = await repository.createObjective(userId, {
      ...parsed,
      scheduledFor: parsed.scheduledFor || null,
      dueDate: parsed.dueDate || null
    })
    await repository.createAuditEvent(userId, 'create', 'objective', record.id, { title: record.title, via: 'assistant' })
    created.push({ type: 'objective', title: record.title })
    return JSON.stringify({ ok: true, id: record.id, title: record.title })
  }

  if (name === 'create_journal_entry') {
    const parsed = journalEntrySchema.parse(input)
    const record = await repository.createJournalEntry(userId, parsed)
    await repository.createAuditEvent(userId, 'create', 'journal', record.id, { title: record.title, via: 'assistant' })
    created.push({ type: 'journal entry', title: record.title })
    return JSON.stringify({ ok: true, id: record.id, title: record.title })
  }

  if (name === 'create_time_block') {
    const parsed = timeBlockSchema.parse(input)
    const record = await repository.createTimeBlock(userId, { ...parsed, objectiveId: parsed.objectiveId || null })
    await repository.createAuditEvent(userId, 'create', 'time-block', record.id, { title: record.title, via: 'assistant' })
    created.push({ type: 'time block', title: record.title })
    return JSON.stringify({ ok: true, id: record.id, title: record.title })
  }

  if (name === 'get_finance_options') {
    const overview = await repository.getFinanceOverview(userId)
    return JSON.stringify({
      accounts: overview.accounts.map(item => ({ id: item.id, name: item.name, type: item.type, currency: item.currency })),
      categories: overview.categories.map(item => ({ id: item.id, name: item.name, type: item.type }))
    })
  }

  if (name === 'create_finance_transaction') {
    const parsed = financeTransactionSchema.parse(input)
    const record = await repository.createFinanceTransaction(userId, parsed)
    await repository.createAuditEvent(userId, 'create', 'transaction', record.id, { title: record.title, via: 'assistant' })
    created.push({ type: 'transaction', title: record.title })
    return JSON.stringify({ ok: true, id: record.id, title: record.title })
  }

  throw new Error(`Unknown tool: ${name}`)
}

function buildSystemPrompt(displayName: string) {
  return [
    'You are the concierge assistant inside "The Serene Executive", a personal planner covering priorities (objectives), calendar time blocks, a diary, yearly goals, and manual finance tracking.',
    `You are talking to ${displayName}. Today is ${new Date().toISOString()} (UTC).`,
    'You can create entries with the provided tools. Rules:',
    '- If an essential detail is missing or ambiguous (goal progress target, time of a block, transaction amount), ask ONE concise follow-up question instead of guessing.',
    '- Minor presentation fields (tone, status, tags) never need a question — pick something sensible.',
    '- All datetimes must be ISO 8601 UTC with a Z suffix, e.g. 2026-07-30T09:00:00Z. Resolve relative dates ("tomorrow morning") from today\'s date.',
    '- For finance transactions, call get_finance_options first and match account/category by name; ask the user if no clear match exists.',
    '- After creating something, confirm it in one short sentence.',
    '- Keep replies brief, warm, and concrete. Do not invent data you did not create or read.'
  ].join('\n')
}

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'assistant-chat', 20, 60_000)

  const body = chatRequestSchema.parse(await readBody(event))
  const client = useAnthropic()

  const messages: Anthropic.MessageParam[] = body.messages.map(item => ({
    role: item.role,
    content: item.content
  }))

  const created: CreatedAction[] = []
  let response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: buildSystemPrompt(user.displayName),
    tools,
    messages
  })

  let iterations = 0
  while (response.stop_reason === 'tool_use' && iterations < 6) {
    iterations += 1
    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type !== 'tool_use') {
        continue
      }

      try {
        const result = await executeTool(user.id, block.name, block.input, created)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      } catch (error) {
        const detail = error instanceof z.ZodError
          ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
          : error instanceof Error
            ? error.message
            : 'Tool execution failed.'
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${detail}`, is_error: true })
      }
    }

    messages.push({ role: 'user', content: toolResults })

    response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: buildSystemPrompt(user.displayName),
      tools,
      messages
    })
  }

  let reply = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim()

  if (response.stop_reason === 'refusal' || !reply) {
    reply = reply || 'I could not complete that request. Could you rephrase it?'
  }

  return { reply, created }
})
