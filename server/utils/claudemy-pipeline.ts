import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type {
  ClaudemyCourseRecord,
  ClaudemyLessonRecord,
  ClaudemyNote,
  ClaudemyPlanBlock,
  ClaudemySplit,
  ClaudemySubtopic,
  ClaudemyTheme
} from '~~/shared/types/claudemy'
import { checkClaudemyLesson, countAgreement, sameSourcePage } from '~~/shared/utils/claudemy-check'
import { isClaudemyWorking } from '~~/shared/utils/claudemy-stages'
import { useAnthropic } from '~~/server/utils/anthropic-client'
import { type ClaudemyPage, useClaudemyRepository } from '~~/server/utils/claudemy-repository'
import { readWebPage } from '~~/server/utils/page-reader'

/**
 * Claudemy (github.com/assafkip/claudemy, MIT) as a set of resumable steps.
 *
 * The original runs as one long agent session with parallel sub-agents. A
 * serverless function gets at most 300 seconds, so here each request does
 * one bounded unit of work — map the topic, find sources for a few
 * sub-topics, fetch a handful of pages, read four of them, cluster, plan,
 * write a lesson or three — saves the result, and returns. The page drives
 * the loop by calling the step endpoint until the course reaches a stage
 * that waits for the learner.
 */

export const CLAUDEMY_MODEL = 'claude-opus-5-5'
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

/** Leaves room under the 300 s function limit to save the result and answer. */
const STEP_BUDGET_MS = 250_000
const SUBTOPICS_PER_SOURCING_CALL = 6
const PAGES_PER_FETCH = 8
const PAGES_PER_READ = 4
const LESSONS_PER_WRITE = 3
const MAX_PAGES = 45
const MAX_PAGES_PER_SITE = 3
const MAX_SOURCING_ROUNDS = 3
const MIN_PAGES = 20
const MIN_PAGES_TO_TEACH = 6
const MAX_LESSON_ATTEMPTS = 3
const READ_WORDS = 4500
const STORY_PAGE_WORDS = 2500

const SYSTEM = [
  'You are part of Claudemy, inside "The Serene Executive" planner. Claudemy researches a topic on the web, works out what most good sources agree on and where they split, and turns that into a short course: two-minute lessons where two hosts talk, each with a one-screen card and one small thing to try.',
  '',
  'Honesty rules, at every step:',
  '- A citation must be a page the class actually read. Never invent, guess or "fix" a url.',
  '- A source\'s numbers are its claims; present them as such ("one study found", "by their count").',
  '- Health, legal, financial and safety topics: say where advice depends on the person\'s situation, and point to a professional where the sources do.',
  '- Offer, don\'t order. Never address the learner with "you need to", "you must", "you should", "you have to", "make sure" or "don\'t forget".',
  '- No emdashes, en dashes or double hyphens anywhere in your output. Use commas, full stops or parentheses.'
].join('\n')

type Repository = ReturnType<typeof useClaudemyRepository>

class StepError extends Error {}

function deadlineSignal(deadline: number) {
  return AbortSignal.timeout(Math.max(5_000, deadline - Date.now()))
}

function words(text: string, limit: number) {
  const parts = text.split(/\s+/)
  return parts.length > limit ? `${parts.slice(0, limit).join(' ')} …` : text
}

function levelLine(course: ClaudemyCourseRecord) {
  const level = {
    beginner: 'a beginner, starting from scratch',
    intermediate: 'an intermediate learner who knows the basics',
    advanced: 'an advanced learner who wants depth and the contested edges'
  }[course.level]
  return `The learner is ${level}.`
}

function personLine(course: ClaudemyCourseRecord) {
  return course.person
    ? `Person mode: this class is built from the published work of ${course.person}. Sources are their own writing (their site, newsletter, books' free chapters, talks with transcripts), and lessons say "${course.person} says" rather than "most sources agree".`
    : ''
}

function subtopicList(course: ClaudemyCourseRecord) {
  return course.subtopics.map(topic => `${topic.id} ${topic.name}: ${topic.covers}`).join('\n')
}

// ---------------------------------------------------------------- Claude calls

function usageOf(message: Anthropic.Beta.BetaMessage) {
  const usage = message.usage
  // Cache writes bill at 1.25x and reads at 0.1x; folding them into input
  // keeps the running cost estimate honest without a column for each.
  const input =
    (usage.input_tokens || 0) +
    Math.round((usage.cache_creation_input_tokens || 0) * 1.25) +
    Math.round((usage.cache_read_input_tokens || 0) * 0.1)
  return {
    inputTokens: input,
    outputTokens: usage.output_tokens || 0,
    webSearches: usage.server_tool_use?.web_search_requests || 0
  }
}

function assertUsable(message: Anthropic.Beta.BetaMessage) {
  if (message.stop_reason === 'refusal') {
    throw new StepError(
      'Claude declined this step. A different wording of the topic may get through; the rest of the course is unaffected.'
    )
  }
  if (message.stop_reason === 'max_tokens') {
    throw new StepError('The answer ran out of room before it finished. Retrying usually works.')
  }
}

/** One request whose answer is JSON matching `schema` (structured outputs). */
async function structuredCall<T extends z.ZodType>(
  repository: Repository,
  courseId: string,
  schema: T,
  request: { system: string; prompt: string; maxTokens: number; deadline: number }
): Promise<z.infer<T>> {
  const stream = useAnthropic().beta.messages.stream(
    {
      model: CLAUDEMY_MODEL,
      max_tokens: request.maxTokens,
      betas: [FALLBACK_BETA],
      // A safety-classifier decline is retried server-side on the model
      // Anthropic recommends for that category instead of failing the step.
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: request.prompt }]
    },
    { signal: deadlineSignal(request.deadline) }
  )

  const message = await stream.finalMessage()
  await repository.addUsage(courseId, usageOf(message))
  assertUsable(message)

  if (!message.parsed_output) {
    throw new StepError('The answer did not match the expected shape. Retrying usually works.')
  }
  return message.parsed_output as z.infer<T>
}

function toolSchema(schema: z.ZodType) {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema) as Record<string, unknown>
  return json as Anthropic.Beta.BetaTool['input_schema']
}

/**
 * A request that may search the web and then hands its result to a strict
 * client tool. Structured outputs cannot be combined with the citations that
 * search results carry, so the schema guarantee comes from the tool instead.
 */
async function researchCall<T extends z.ZodType>(
  repository: Repository,
  courseId: string,
  schema: T,
  request: {
    prompt: string
    toolName: string
    toolDescription: string
    maxSearches: number
    deadline: number
  }
): Promise<z.infer<T>> {
  const client = useAnthropic()
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: request.prompt }]

  for (let turn = 0; turn < 4; turn += 1) {
    const stream = client.beta.messages.stream(
      {
        model: CLAUDEMY_MODEL,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: SYSTEM,
        tools: [
          { type: 'web_search_20260209', name: 'web_search', max_uses: request.maxSearches },
          {
            name: request.toolName,
            description: request.toolDescription,
            strict: true,
            input_schema: toolSchema(schema)
          }
        ],
        messages
      },
      { signal: deadlineSignal(request.deadline) }
    )

    const message = await stream.finalMessage()
    await repository.addUsage(courseId, usageOf(message))
    assertUsable(message)

    const call = message.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use' && block.name === request.toolName
    )
    if (call) {
      const parsed = schema.safeParse(call.input)
      if (parsed.success) {
        return parsed.data
      }
      messages.push(
        { role: 'assistant', content: message.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: call.id,
              is_error: true,
              content: `The input did not validate: ${parsed.error.message}. Call ${request.toolName} again with corrected input.`
            }
          ]
        }
      )
      continue
    }

    // A long server-tool turn can pause; sending it back resumes it.
    messages.push({ role: 'assistant', content: message.content })
    if (message.stop_reason !== 'pause_turn') {
      messages.push({ role: 'user', content: `Call ${request.toolName} now with what you have found.` })
    }
  }

  throw new StepError(`The research step finished without handing back a result. Retrying usually works.`)
}

// ---------------------------------------------------------------- Step 1: map

const mapSchema = z.object({
  subtopics: z.array(z.object({ name: z.string(), covers: z.string() }))
})

async function mapTopic(repository: Repository, course: ClaudemyCourseRecord, deadline: number) {
  const result = await researchCall(repository, course.id, mapSchema, {
    toolName: 'submit_topic_map',
    toolDescription: 'Hand back the sub-topics that together cover the course. Call it once, when the map is done.',
    maxSearches: 5,
    deadline,
    prompt: [
      `Topic: ${course.topic}`,
      levelLine(course),
      personLine(course),
      '',
      'Step 1, map the topic. Search first to see how this topic is usually taught; do not guess the syllabus from memory.',
      'Then call submit_topic_map with 12 to 18 sub-topics that together cover what a learner at this level gets from a good course, in teaching order.',
      'Each sub-topic: a short name, and one line on what it covers. Every reader later files notes under these, so sources can be compared; keep them distinct and not overlapping.'
    ]
      .filter(Boolean)
      .join('\n')
  })

  const subtopics: ClaudemySubtopic[] = result.subtopics
    .filter(topic => topic.name.trim())
    .slice(0, 18)
    .map((topic, index) => ({
      id: `T${String(index + 1).padStart(2, '0')}`,
      name: topic.name.trim(),
      covers: topic.covers.trim()
    }))

  if (subtopics.length < 6) {
    throw new StepError('The topic map came back too thin to build a course on. Retrying usually works.')
  }
  await repository.updateCourse(course.id, { subtopics, stage: 'sourcing', sourcingRound: 1, sourcingCursor: 0 })
}

// ---------------------------------------------------------------- Step 2: reading list

const sourcesSchema = z.object({
  pages: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      subtopics: z.array(z.string()),
      kind: z.enum(['practitioner', 'reference', 'research', 'dissent', 'person']),
      why: z.string()
    })
  )
})

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function savedPerSubtopic(course: ClaudemyCourseRecord, pages: ClaudemyPage[]) {
  return course.subtopics.map(topic => ({
    topic,
    saved: pages.filter(page => page.status === 'saved' && page.subtopics.includes(topic.id)).length
  }))
}

async function findSources(repository: Repository, course: ClaudemyCourseRecord, userId: string, deadline: number) {
  const pages = await repository.listPages(course.id)
  const replacing = course.sourcingRound > 1

  const focus = replacing
    ? savedPerSubtopic(course, pages)
        .filter(entry => entry.saved < 2)
        .map(entry => entry.topic)
    : course.subtopics.slice(course.sourcingCursor, course.sourcingCursor + SUBTOPICS_PER_SOURCING_CALL)

  const saved = pages.filter(page => page.status === 'saved').length
  const wanted = replacing
    ? Math.max(focus.length * 2, MIN_PAGES - saved)
    : Math.ceil(32 / Math.ceil(course.subtopics.length / SUBTOPICS_PER_SOURCING_CALL))

  const listed = pages.map(page => `- ${page.url}${page.status === 'failed' ? ` (could not be read: ${page.failReason})` : ''}`)

  const result = await researchCall(repository, course.id, sourcesSchema, {
    toolName: 'submit_reading_list',
    toolDescription: 'Hand back the pages worth learning from. Call it once, when the list for these sub-topics is done.',
    maxSearches: replacing ? 6 : 8,
    deadline,
    prompt: [
      `Topic: ${course.topic}`,
      levelLine(course),
      personLine(course),
      '',
      'All sub-topics of the course:',
      subtopicList(course),
      '',
      replacing
        ? `Step 2, replacements. These sub-topics have fewer than two readable pages so far: ${focus.map(topic => topic.id).join(', ')}. Find about ${wanted} more pages, mostly for them.`
        : `Step 2, the reading list, for these sub-topics: ${focus.map(topic => topic.id).join(', ')}. Run several searches per sub-topic and find about ${wanted} pages worth learning from.`,
      course.person
        ? `Only pages written by ${course.person} themself: their own site, newsletter archive, or published pieces.`
        : [
            'Prefer a mix: people who do the work and write concretely about it; primary and reference sources (official docs, standards bodies, free textbook chapters, research summaries); and a few that disagree with the mainstream view. Disagreement is where a learner has to think.',
            `No more than ${MAX_PAGES_PER_SITE} pages from any one site, so one voice cannot dominate.`
          ].join('\n'),
      'Skip content farms, listicles with no substance, pages behind a login or paywall, PDFs, video-only pages, and anything that is mostly a sales page.',
      'Only list urls you saw in real search results, copied exactly. Search models invent plausible urls; every url here is fetched, and a dead one is wasted.',
      'For each page: the url, its title, the sub-topic ids it serves (from the full list), what kind of source it is, and one line on why it is worth reading.',
      listed.length ? `\nAlready on the list (do not repeat these):\n${listed.join('\n')}` : ''
    ]
      .filter(Boolean)
      .join('\n')
  })

  // The code, not the model, enforces the per-site cap and the no-repeat rule.
  const known = new Set(pages.map(page => sameSourcePage(page.url)))
  const perSite = new Map<string, number>()
  for (const page of pages) {
    if (page.status !== 'failed') {
      perSite.set(hostOf(page.url), (perSite.get(hostOf(page.url)) || 0) + 1)
    }
  }
  const validTopics = new Set(course.subtopics.map(topic => topic.id))
  const room = MAX_PAGES - pages.length

  const additions: { url: string; title: string; kind: string; subtopics: string[] }[] = []
  for (const page of result.pages) {
    const host = hostOf(page.url)
    const key = sameSourcePage(page.url)
    if (!host || !/^https?:\/\//i.test(page.url) || known.has(key) || additions.length >= room) {
      continue
    }
    if (!course.person && (perSite.get(host) || 0) >= MAX_PAGES_PER_SITE) {
      continue
    }
    const subtopics = page.subtopics.filter(id => validTopics.has(id))
    known.add(key)
    perSite.set(host, (perSite.get(host) || 0) + 1)
    additions.push({
      url: page.url.trim(),
      title: page.title.trim(),
      kind: page.kind,
      subtopics: subtopics.length ? subtopics : focus.slice(0, 1).map(topic => topic.id)
    })
  }
  await repository.addPages(userId, course.id, additions)

  const cursor = course.sourcingCursor + SUBTOPICS_PER_SOURCING_CALL
  if (replacing || cursor >= course.subtopics.length) {
    await repository.updateCourse(course.id, { stage: 'fetching', sourcingCursor: 0 })
  } else {
    await repository.updateCourse(course.id, { sourcingCursor: cursor })
  }
}

// ---------------------------------------------------------------- Step 2b: fetch

async function fetchPages(repository: Repository, course: ClaudemyCourseRecord) {
  const pages = await repository.listPages(course.id)
  const pending = pages.filter(page => page.status === 'pending').slice(0, PAGES_PER_FETCH)
  const savedKeys = new Map(
    pages.filter(page => page.status === 'saved').map(page => [sameSourcePage(page.url), page.seq])
  )

  const results = await Promise.all(pending.map(page => readWebPage(page.url)))
  for (const [index, page] of pending.entries()) {
    const result = results[index]!
    if (!result.ok) {
      await repository.updatePage(page.id, { status: 'failed', failReason: result.reason })
      continue
    }
    // Two listed urls can land on the same page after redirects.
    const duplicate = savedKeys.get(sameSourcePage(result.url))
    if (duplicate) {
      await repository.updatePage(page.id, { status: 'failed', failReason: `same page as S${duplicate}` })
      continue
    }
    savedKeys.set(sameSourcePage(result.url), page.seq)
    await repository.updatePage(page.id, {
      status: 'saved',
      url: result.url,
      title: result.title || page.title,
      words: result.words,
      content: result.text
    })
  }

  if (pages.some(page => page.status === 'pending' && !pending.includes(page))) {
    return
  }

  const after = await repository.listPages(course.id)
  const saved = after.filter(page => page.status === 'saved').length
  const thin = savedPerSubtopic(course, after).filter(entry => entry.saved < 2)
  const canSearchMore = course.sourcingRound < MAX_SOURCING_ROUNDS && after.length < MAX_PAGES

  if ((saved < MIN_PAGES || thin.length) && canSearchMore) {
    await repository.updateCourse(course.id, { stage: 'sourcing', sourcingRound: course.sourcingRound + 1 })
    return
  }
  if (saved < MIN_PAGES_TO_TEACH) {
    throw new StepError(
      `Only ${saved} of ${after.length} pages could be read, too few to teach from honestly. A broader or more common topic usually finds more.`
    )
  }
  await repository.updateCourse(course.id, { stage: 'reading' })
}

// ---------------------------------------------------------------- Step 3: read

const readSchema = z.object({
  pages: z.array(
    z.object({
      source: z.number(),
      skipped: z.boolean(),
      skipReason: z.string(),
      notes: z.array(
        z.object({
          subtopic: z.string(),
          also: z.array(z.string()),
          idea: z.string(),
          quote: z.string(),
          kind: z.enum(['technique', 'rule of thumb', 'mistake', 'number', 'story', 'definition', 'template', 'test']),
          level: z.enum(['foundation', 'core', 'advanced']),
          bias: z.string()
        })
      )
    })
  ),
  disagreements: z.array(z.object({ sources: z.array(z.number()), on: z.string() })),
  stories: z.array(z.object({ source: z.number(), story: z.string() }))
})

async function readPages(repository: Repository, course: ClaudemyCourseRecord, deadline: number) {
  const pages = await repository.listPages(course.id)
  const batch = pages.filter(page => page.status === 'saved' && !page.readAt).slice(0, PAGES_PER_READ)

  if (!batch.length) {
    await repository.updateCourse(course.id, { stage: 'clustering' })
    return
  }

  const result = await structuredCall(repository, course.id, readSchema, {
    system: SYSTEM,
    maxTokens: 20000,
    deadline,
    prompt: [
      `Topic: ${course.topic}`,
      levelLine(course),
      personLine(course),
      '',
      'Sub-topics (file every note under one of these ids):',
      subtopicList(course),
      '',
      'Step 3, read. Turn each page below into concrete, cited lesson candidates that can be compared across sources.',
      '- A page with nothing teachable on the topic is skipped, and so is a teaser or summary of a paywalled article, even if it carries one number. Say why in one line.',
      '- Concrete beats abstract: a technique, a number, a rule of thumb, a test, a template, a common mistake. "Practice makes perfect" with nothing behind it is not a note.',
      '- 3 to 10 notes per page, the strongest: concrete, well sourced, useful at this level. One or two sentences each.',
      '- File each note under the one sub-topic it fits best; list another in "also" only if it clearly serves it too.',
      '- A short quote (under 25 words) when the wording matters, otherwise an empty string.',
      '- A source\'s numbers are its claims: write "(their claim)".',
      '- bias: when a page sells a course, a product or a service, say so in one line; otherwise an empty string.',
      '- Note stories or examples worth retelling in audio; lessons land on a story.',
      '- disagreements: where these pages contradict each other, on what (up to 5). stories: the best stories, one line each (up to 5).',
      '',
      ...batch.map(page =>
        [`=== Source S${page.seq}: ${page.title}`, `url: ${page.url}`, '', words(page.content, READ_WORDS), ''].join('\n')
      )
    ]
      .filter(Boolean)
      .join('\n')
  })

  const validTopics = new Set(course.subtopics.map(topic => topic.id))
  const bySeq = new Map(batch.map(page => [page.seq, page]))
  const readAt = new Date().toISOString()

  for (const page of batch) {
    const answer = result.pages.find(entry => entry.source === page.seq)
    const notes: ClaudemyNote[] = (answer?.skipped ? [] : answer?.notes || [])
      .filter(note => validTopics.has(note.subtopic) && note.idea.trim())
      .slice(0, 12)
      .map((note, index) => ({
        id: `S${page.seq}.N${index + 1}`,
        subtopic: note.subtopic,
        also: note.also.filter(id => validTopics.has(id) && id !== note.subtopic),
        idea: note.idea.trim(),
        quote: note.quote.trim(),
        kind: note.kind,
        level: note.level,
        bias: note.bias.trim()
      }))
    await repository.updatePage(page.id, {
      readAt,
      notes,
      skipReason: !answer ? 'the reader returned nothing for this page' : answer.skipped ? answer.skipReason : ''
    })
  }

  const knownSeq = new Set(pages.map(page => page.seq))
  await repository.updateCourse(course.id, {
    disagreements: [
      ...course.disagreements,
      ...result.disagreements
        .map(entry => ({ sources: entry.sources.filter(seq => knownSeq.has(seq)), on: entry.on.trim() }))
        .filter(entry => entry.sources.length && entry.on)
    ],
    stories: [
      ...course.stories,
      ...result.stories.filter(entry => bySeq.has(entry.source) && entry.story.trim())
    ]
  })
}

// ---------------------------------------------------------------- Step 4: agreement map

const mapOfAgreementSchema = z.object({
  themes: z.array(
    z.object({
      idea: z.string(),
      subtopics: z.array(z.string()),
      noteIds: z.array(z.string()),
      disagreements: z.array(z.object({ source: z.number(), claim: z.string() })),
      level: z.enum(['foundation', 'core', 'advanced']),
      bestStory: z.object({ source: z.number(), line: z.string() }).nullable()
    })
  ),
  splits: z.array(
    z.object({
      question: z.string(),
      sides: z.array(z.object({ position: z.string(), sources: z.array(z.number()) })),
      howToDecide: z.string()
    })
  ),
  gaps: z.array(z.string())
})

function allNotes(pages: ClaudemyPage[]) {
  return pages.flatMap(page => page.notes.map(note => ({ ...note, source: page.seq })))
}

async function buildAgreementMap(repository: Repository, course: ClaudemyCourseRecord, deadline: number) {
  const pages = await repository.listPages(course.id)
  const notes = allNotes(pages)
  if (notes.length < 10) {
    throw new StepError(
      `The readers found only ${notes.length} usable notes across the pages, too few to build a course on. A broader topic usually finds more.`
    )
  }

  const sources = pages
    .filter(page => page.notes.length)
    .map(page => `S${page.seq} ${page.title} (${page.url})`)
  const noteLines = notes.map(note =>
    [
      `${note.id} [${note.subtopic}${note.also.length ? `; also ${note.also.join(', ')}` : ''}] ${note.kind}, ${note.level}: ${note.idea}`,
      note.quote ? ` "${note.quote}"` : '',
      note.bias ? ` (bias: ${note.bias})` : ''
    ].join('')
  )
  const seen = course.disagreements.map(entry => `${entry.sources.map(seq => `S${seq}`).join(' vs ')}: ${entry.on}`)

  const result = await structuredCall(repository, course.id, mapOfAgreementSchema, {
    system: SYSTEM,
    maxTokens: 24000,
    deadline,
    prompt: [
      `Topic: ${course.topic}`,
      levelLine(course),
      personLine(course),
      '',
      'Sub-topics:',
      subtopicList(course),
      '',
      'Step 4, the agreement map. Cluster every note into 30 to 45 themes.',
      '- A theme is one teachable idea, written as an instruction: "Anchor with a specific number, not a round one", not "anchoring".',
      '- Two ideas that point opposite ways are two themes, with the disagreement recorded on both.',
      '- noteIds: every note that supports the theme (a note can support more than one theme). The agreement counts are computed from these, so be complete and exact.',
      '- subtopics: the theme\'s sub-topic ids, main one first.',
      '- disagreements: sources that argue against it, with their claim in one line; empty when none was found.',
      '- level: foundation, core or advanced. bestStory: the best story or example for it, or null.',
      'Then splits: the sharpest disagreements between good sources, the sides with their sources, and how a learner could decide. These are decisions, not lessons.',
      'Then gaps: sub-topics with thin evidence, and what a learner would expect that no source covered.',
      '',
      'Sources:',
      ...sources,
      '',
      'Notes:',
      ...noteLines,
      seen.length ? `\nDisagreements the readers saw:\n${seen.join('\n')}` : ''
    ]
      .filter(Boolean)
      .join('\n')
  })

  const knownSeq = new Set(pages.filter(page => page.status === 'saved').map(page => page.seq))
  const validTopics = new Set(course.subtopics.map(topic => topic.id))
  const noteIds = new Set(notes.map(note => note.id))

  const themes: ClaudemyTheme[] = result.themes
    .map(theme => ({ ...theme, noteIds: theme.noteIds.filter(id => noteIds.has(id)) }))
    .filter(theme => theme.noteIds.length && theme.idea.trim())
    .map((theme, index) => {
      const subtopics = theme.subtopics.filter(id => validTopics.has(id))
      // N of M is counted here from the notes; the model only says which notes support what.
      const count = countAgreement(subtopics, theme.noteIds, notes)
      return {
        id: `TH${String(index + 1).padStart(2, '0')}`,
        idea: theme.idea.trim(),
        subtopics,
        noteIds: theme.noteIds,
        ...count,
        disagreements: theme.disagreements.filter(entry => knownSeq.has(entry.source)),
        level: theme.level,
        bestStory: theme.bestStory && knownSeq.has(theme.bestStory.source) ? theme.bestStory : null
      }
    })

  if (themes.length < 5) {
    throw new StepError('The agreement map came back too thin to plan lessons from. Retrying usually works.')
  }

  const splits: ClaudemySplit[] = result.splits
    .map(split => ({
      question: split.question.trim(),
      sides: split.sides.map(side => ({ position: side.position.trim(), sources: side.sources.filter(seq => knownSeq.has(seq)) })),
      howToDecide: split.howToDecide.trim()
    }))
    .filter(split => split.question && split.sides.length >= 2)

  await repository.updateCourse(course.id, {
    themes,
    splits,
    gaps: result.gaps.map(gap => gap.trim()).filter(Boolean),
    stage: 'planning'
  })
}

// ---------------------------------------------------------------- Step 5: plan

const planSchema = z.object({
  arcs: z.array(
    z.object({
      title: z.string(),
      why: z.string(),
      finish: z.string(),
      lessons: z.array(
        z.object({
          handle: z.string(),
          themeIds: z.array(z.string()),
          idea: z.string(),
          whyItMatters: z.string(),
          story: z.object({ line: z.string(), source: z.number().nullable() }),
          tryIt: z.object({
            energy: z.enum(['Quick Win', 'Deep Focus', 'People', 'Admin']),
            minutes: z.number(),
            what: z.string()
          }),
          rule: z.string()
        })
      )
    })
  )
})

function themeLine(theme: ClaudemyTheme) {
  const disagreements = theme.disagreements.map(entry => `S${entry.source}: ${entry.claim}`).join('; ')
  return [
    `${theme.id} (${theme.level}, ${theme.agree} of ${theme.of} sources agree${theme.thin ? ', thin evidence' : ''}) ${theme.idea}`,
    disagreements ? `  Pushback: ${disagreements}` : '',
    theme.bestStory ? `  Story (S${theme.bestStory.source}): ${theme.bestStory.line}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

async function planLessons(repository: Repository, course: ClaudemyCourseRecord, userId: string, deadline: number) {
  const pages = await repository.listPages(course.id)
  const knownSeq = new Set(pages.filter(page => page.status === 'saved').map(page => page.seq))
  const themesById = new Map(course.themes.map(theme => [theme.id, theme]))

  const result = await structuredCall(repository, course.id, planSchema, {
    system: SYSTEM,
    maxTokens: 20000,
    deadline,
    prompt: [
      `Topic: ${course.topic}`,
      levelLine(course),
      personLine(course),
      '',
      `Step 5, the lesson plan: ${course.lessonCount} lessons in arcs of about 4. This is the judgment step.`,
      '- Order by what a learner needs first: foundations, then the core, then the advanced and contested.',
      '- Within that, prefer ideas with wide agreement and a concrete thing to practise. A widely agreed idea nobody can act on is weaker than a slightly less agreed one you can try today.',
      '- One idea per lesson, with a 2 to 3 word handle. Named ideas are easier to recall.',
      '- Each arc: a title, one line on why this arc, and its own finish (what the learner can do at the end of it).',
      '- Each lesson: handle, the theme ids it teaches (main one first), the idea in two lines, why it matters, the story or example it lands on (with its source number, or null), the thing to try (energy, 2 to 15 minutes, spelled out), and one rule to keep.',
      '- Every story and number has to come from the themes below; nothing from memory.',
      '',
      'Themes, with agreement counted from the sources:',
      ...course.themes.map(themeLine),
      course.splits.length ? `\nWhere good sources split (these stay decisions, not lessons):\n${course.splits.map(split => `- ${split.question}`).join('\n')}` : '',
      course.gaps.length ? `\nCoverage gaps:\n${course.gaps.map(gap => `- ${gap}`).join('\n')}` : ''
    ]
      .filter(Boolean)
      .join('\n')
  })

  const lessons: { number: number; arc: number; handle: string; plan: ClaudemyPlanBlock }[] = []
  const arcs = result.arcs
    .map(arc => ({
      title: arc.title.trim(),
      why: arc.why.trim(),
      finish: arc.finish.trim(),
      lessons: arc.lessons
        .map(lesson => ({ ...lesson, themeIds: lesson.themeIds.filter(id => themesById.has(id)) }))
        .filter(lesson => lesson.themeIds.length && lesson.handle.trim())
    }))
    .filter(arc => arc.lessons.length)

  for (const [arcIndex, arc] of arcs.entries()) {
    for (const lesson of arc.lessons) {
      if (lessons.length >= course.lessonCount + 2) {
        break
      }
      const main = themesById.get(lesson.themeIds[0]!)!
      lessons.push({
        number: lessons.length + 1,
        arc: arcIndex,
        handle: lesson.handle.trim(),
        plan: {
          themeIds: lesson.themeIds,
          agree: main.agree,
          of: main.of,
          idea: lesson.idea.trim(),
          whyItMatters: lesson.whyItMatters.trim(),
          story: {
            line: lesson.story.line.trim(),
            source: lesson.story.source !== null && knownSeq.has(lesson.story.source) ? lesson.story.source : null
          },
          tryIt: {
            energy: lesson.tryIt.energy,
            minutes: Math.min(15, Math.max(2, Math.round(lesson.tryIt.minutes))),
            what: lesson.tryIt.what.trim()
          },
          rule: lesson.rule.trim()
        }
      })
    }
  }

  if (lessons.length < 3) {
    throw new StepError('The lesson plan came back with too few usable lessons. Retrying usually works.')
  }

  await repository.replaceLessons(userId, course.id, lessons)
  await repository.updateCourse(course.id, {
    arcs: arcs.map(({ title, why, finish }) => ({ title, why, finish })),
    lessonCount: lessons.length,
    stage: 'sample'
  })
}

// ---------------------------------------------------------------- Steps 6 and 7: write

const lessonSchema = z.object({
  handle: z.string(),
  script: z.array(z.object({ speaker: z.enum(['A', 'B']), text: z.string() })),
  card: z.object({
    ideaLines: z.array(z.string()),
    impact: z.string(),
    whoSaysIt: z.string(),
    tryIt: z.object({
      energy: z.enum(['Quick Win', 'Deep Focus', 'People', 'Admin']),
      minutes: z.number(),
      steps: z.string()
    }),
    rule: z.string(),
    deeper: z.array(z.object({ label: z.string(), url: z.string() }))
  })
})

/**
 * The shape every lesson copies until the learner approves lesson 1, after
 * which lesson 1 itself is the example. Invented topic and placeholder urls,
 * as in Claudemy's own lesson-example.md: never cite these.
 */
const EXAMPLE_LESSON = `Illustrative example (topic "pricing your freelance work", beginner). The urls are placeholders; never cite them.
Script:
A: Okay, lesson one. Three doors. And honestly? This one's kind of a cheat code.
B: [laughs] Big claim. Go.
A: So most people, when they quote a project, send one number. One project, one price.
B: Mm-hmm. Which feels clean.
A: Feels clean! But with one number, the client's only question becomes, is this worth it? Yes or no.
B: Oof. That's a scary question to hand somebody.
A: Right. Give them three options, and the question flips. Now it's, which one's the best value?
B: Oh, that's a totally different conversation.
A: And this one's not fringe. Most of the pricing sources we read say it, in some form. Two prefer a single range, to keep the choice simple.
B: Okay, but does option three just mean more work?
A: No! That's the trap. Option three is a better path to the result. Faster, safer. Not more hours from you.
(... and so on: a real story or number from a page, a concrete example in use, the small thing to try, one line on what changes.)
Card:
ideaLines: ["One price makes the buyer ask 'is this worth it?' Three options make them ask 'which is the best value?'", "Say the biggest option first, then the smallest, land in the middle.", "Option three is a better path to the result, not more hours from you."]
impact: "Every quote you send has room above it."
whoSaysIt: "9 of 14 pricing sources agree. Two prefer a single range, to keep the choice simple."
tryIt: { energy: "Quick Win", minutes: 10, steps: "Take your last quote, or your next one, and split it.\\nDoor 1: the core result, nothing extra.\\nDoor 2: what you'd normally quote.\\nDoor 3: a faster or safer path to the same result.\\nSay them in this order: Door 3, then Door 1, then Door 2." }
rule: "Every price I say comes as three named options, the biggest first."
deeper: [{ label: "On offering options", url: "https://example.com/placeholder-1" }]`

function approvedExample(lesson: ClaudemyLessonRecord) {
  const lines = (lesson.script || []).map(turn => `${turn.speaker}: ${turn.text}`)
  return [
    `The approved lesson ${lesson.number}, "${lesson.handle}". Copy its shape, voice and length, not its content.`,
    'Script:',
    ...lines,
    'Card:',
    JSON.stringify(lesson.card, null, 2)
  ].join('\n')
}

async function writeLesson(
  repository: Repository,
  course: ClaudemyCourseRecord,
  lesson: ClaudemyLessonRecord,
  context: { pages: ClaudemyPage[]; sample: ClaudemyLessonRecord | null; deadline: number }
) {
  const themesById = new Map(course.themes.map(theme => [theme.id, theme]))
  const themes = lesson.plan.themeIds.map(id => themesById.get(id)).filter((theme): theme is ClaudemyTheme => Boolean(theme))
  const notesById = new Map(allNotes(context.pages).map(note => [note.id, note]))
  const saved = context.pages.filter(page => page.status === 'saved')
  const bySeq = new Map(saved.map(page => [page.seq, page]))

  const supporting = new Set<number>()
  for (const theme of themes) {
    for (const id of theme.noteIds) {
      const note = notesById.get(id)
      if (note) {
        supporting.add(note.source)
      }
    }
  }
  if (lesson.plan.story.source) {
    supporting.add(lesson.plan.story.source)
  }
  const storyPage = lesson.plan.story.source ? bySeq.get(lesson.plan.story.source) : undefined
  const arc = course.arcs[lesson.arc]

  // Everything that is the same for every lesson goes first, so the system
  // prompt is a cacheable prefix across the course's writer calls.
  const system = [
    SYSTEM,
    '',
    'You write one lesson: a two-host script and a one-screen card.',
    'Script:',
    '- Two hosts, A and B, one turn each entry. 280 to 350 words in all (about two minutes of audio).',
    '- Write the way people talk: contractions, short turns, reactions ("right?", "oof", "exactly"), numbers written the way they are said. Energetic, warm, never a lecture.',
    '- At most 3 audio tags, only [laughs], [chuckles] or [sighs], and only at the start of a turn.',
    '- Shape: hook, the idea, how widely sources agree (and who pushes back), one real story or number from a page, a concrete example of it in use, the small thing to try, then one line on what changes.',
    '- Speak to "you", the listener. Assume nothing about them beyond their level.',
    'Card:',
    '- ideaLines: the idea in exactly three lines. impact: one line on what gets better once you do this.',
    '- whoSaysIt: "N of M sources agree", using the count given for the lesson\'s main theme, plus who disagrees and how, in one line.',
    '- tryIt: one small practice anyone at this level can do in 2 to 15 minutes, spelled out so there is nothing to figure out first: the steps, the script, the template.',
    '- rule: one sentence the learner keeps in their playbook. deeper: 2 or 3 of the listed source urls, each with a short label.',
    'Hard rules on facts: every url has to be copied exactly from the sources listed for the lesson. Any other url fails the checker.',
    course.feedback ? `\nThe learner's feedback on the sample lesson (every lesson follows it):\n${course.feedback}` : '',
    '',
    context.sample ? approvedExample(context.sample) : EXAMPLE_LESSON
  ].join('\n')

  const prompt = [
    `Topic: ${course.topic}`,
    levelLine(course),
    personLine(course),
    '',
    `Write lesson ${lesson.number} of ${course.lessonCount}, "${lesson.handle}".`,
    arc ? `Arc: ${arc.title} (${arc.why}). The arc finishes with: ${arc.finish}` : '',
    '',
    'The plan block (the spec; the lesson expands it and never contradicts it):',
    JSON.stringify(lesson.plan, null, 2),
    '',
    'Themes behind it, and the notes they rest on:',
    ...themes.flatMap(theme => [
      themeLine(theme),
      ...theme.noteIds
        .map(id => notesById.get(id))
        .filter(note => note !== undefined)
        .map(note => `  ${note.id}: ${note.idea}${note.quote ? ` "${note.quote}"` : ''}`)
    ]),
    '',
    'Sources you may cite (copy urls exactly):',
    ...[...supporting]
      .map(seq => bySeq.get(seq))
      .filter(page => page !== undefined)
      .map(page => `S${page.seq} ${page.title}: ${page.url}`),
    storyPage
      ? `\nThe page the story comes from (open it before retelling; keep its facts as they are):\n=== S${storyPage.seq}: ${storyPage.url}\n${words(storyPage.content, STORY_PAGE_WORDS)}`
      : '',
    lesson.problems.length
      ? `\nThe last draft of this lesson was refused by the checker for:\n${lesson.problems.map(problem => `- ${problem}`).join('\n')}\nFix every one of these.`
      : ''
  ]
    .filter(Boolean)
    .join('\n')

  const draft = await structuredCall(repository, course.id, lessonSchema, {
    system,
    maxTokens: 12000,
    deadline: context.deadline,
    prompt
  })

  const script = draft.script.map(turn => ({ speaker: turn.speaker, text: turn.text.trim() }))
  const card = {
    ...draft.card,
    ideaLines: draft.card.ideaLines.map(line => line.trim()).filter(Boolean),
    tryIt: { ...draft.card.tryIt, minutes: Math.round(draft.card.tryIt.minutes) }
  }
  const counts = [{ agree: lesson.plan.agree, of: lesson.plan.of }, ...themes.map(theme => ({ agree: theme.agree, of: theme.of }))]
  const check = checkClaudemyLesson(
    { script, card },
    saved.map(page => page.url),
    course.person ? [] : counts
  )

  const attempts = lesson.attempts + 1
  const handle = draft.handle.trim() && draft.handle.trim().split(/\s+/).length <= 4 ? draft.handle.trim() : lesson.handle
  await repository.updateLesson(lesson.id, {
    handle,
    script,
    card,
    words: check.words,
    attempts,
    problems: check.problems,
    status: check.problems.length === 0 ? 'written' : attempts >= MAX_LESSON_ATTEMPTS ? 'failed' : 'planned'
  })
}

async function writeSample(repository: Repository, course: ClaudemyCourseRecord, deadline: number) {
  const [pages, lessons] = await Promise.all([repository.listPages(course.id), repository.listLessons(course.id)])
  const first = lessons[0]
  if (!first) {
    throw new StepError('The course has no planned lessons.')
  }
  if (first.status === 'planned') {
    await writeLesson(repository, course, first, { pages, sample: null, deadline })
  }
  const [after] = await repository.listLessons(course.id)
  if (after && after.status !== 'planned') {
    // Fixing the format on one lesson is cheap; fixing it on twelve is not.
    await repository.updateCourse(course.id, { stage: 'feedback' })
  }
}

async function writeRest(repository: Repository, course: ClaudemyCourseRecord, deadline: number) {
  const [pages, lessons] = await Promise.all([repository.listPages(course.id), repository.listLessons(course.id)])
  const sample = lessons.find(lesson => lesson.number === 1 && lesson.status === 'written') || null
  const next = lessons.filter(lesson => lesson.status === 'planned').slice(0, LESSONS_PER_WRITE)

  if (!next.length) {
    await repository.updateCourse(course.id, { stage: 'done' })
    return
  }

  const results = await Promise.allSettled(
    next.map(lesson => writeLesson(repository, course, lesson, { pages, sample, deadline }))
  )
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failure) {
    throw failure.reason
  }
}

// ---------------------------------------------------------------- the step

function describeError(error: unknown) {
  if (error instanceof StepError) {
    return error.message
  }
  if (error instanceof Anthropic.APIUserAbortError || (error as Error)?.name === 'TimeoutError') {
    return 'This step took longer than the server allows and was stopped. Retrying usually works.'
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The Anthropic API key was rejected. Check NUXT_ANTHROPIC_API_KEY, then retry.'
  }
  if (error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && error.status === 529)) {
    return 'The Claude API is busy or rate limited right now. Waiting a minute and retrying usually works.'
  }
  if (error instanceof Anthropic.APIError) {
    return `The Claude API returned an error (${error.status ?? 'no status'}). Retrying usually works.`
  }
  // useAnthropic() answers 503 when no key is configured.
  if ((error as { statusCode?: number })?.statusCode === 503) {
    return 'Claudemy needs an Anthropic API key. Set NUXT_ANTHROPIC_API_KEY on the server, then retry.'
  }
  return `This step failed: ${(error as Error)?.message || 'unknown error'}`
}

/**
 * Runs one step of the course, if it is in a working stage and no other
 * request holds the step. A failure is saved on the course rather than
 * thrown, so the page shows it and offers a retry.
 */
export async function runClaudemyStep(userId: string, courseId: string) {
  const repository = useClaudemyRepository()
  const course = await repository.findCourse(userId, courseId)
  if (!course) {
    throw createError({ statusCode: 404, statusMessage: 'Course not found.' })
  }
  if (!isClaudemyWorking(course.stage)) {
    return { busy: false }
  }
  if (!(await repository.acquireStep(course.id))) {
    return { busy: true }
  }

  const deadline = Date.now() + STEP_BUDGET_MS
  try {
    switch (course.stage) {
      case 'mapping':
        await mapTopic(repository, course, deadline)
        break
      case 'sourcing':
        await findSources(repository, course, userId, deadline)
        break
      case 'fetching':
        await fetchPages(repository, course)
        break
      case 'reading':
        await readPages(repository, course, deadline)
        break
      case 'clustering':
        await buildAgreementMap(repository, course, deadline)
        break
      case 'planning':
        await planLessons(repository, course, userId, deadline)
        break
      case 'sample':
        await writeSample(repository, course, deadline)
        break
      case 'writing':
        await writeRest(repository, course, deadline)
        break
    }
    await repository.releaseStep(course.id, '')
  } catch (error) {
    console.error('[claudemy] step failed', course.stage, error)
    await repository.releaseStep(course.id, describeError(error))
  }
  return { busy: false }
}
