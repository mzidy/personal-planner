import type { ClaudemyCard, ClaudemyLessonRecord, ClaudemyNote, ClaudemyTurn } from '../types/claudemy'

/**
 * The lesson checker from Claudemy (scripts/check_lessons.py), ported. A lesson
 * passes when its script is two-host dialogue of about two minutes with no
 * banned language, and its card cites only pages the class actually read. A
 * citation to a page that was never read is how invented sources get in, so it
 * is a hard fail.
 */

/** 280 to 350 words renders at about 2:00 to 2:30 of audio. */
export const CLAUDEMY_SCRIPT_WORDS = { min: 280, max: 350 }
const TAGS_MAX = 3
const ALLOWED_TAGS = new Set(['[laughs]', '[chuckles]', '[sighs]'])

// Demand words land as pressure on many learners. The lesson offers; the listener chooses.
const DEMAND = /\b(you need to|you must|you should|make sure|you have to|don['’]t forget)\b/i
const DASH = /—|–|--/
const TAG = /\[[a-z ]+\]/g

// Balanced parentheses stay in a url (Wikipedia's Mercury_(planet)); a lone ")" ends it.
const URL_PATTERN = /https?:\/\/(?:[^\s()<>[\]`]|\([^\s()<>]*\))+/g
// Bold, code spans and sentence ends trail urls in prose; none of that is part of the url.
const TRAILING = new Set(['.', ',', ';', ':', '!', '?', '*', '_', "'", '"', '`'])

function stripTrailing(url: string) {
  let end = url.length
  while (end > 0 && TRAILING.has(url[end - 1]!)) {
    end -= 1
  }
  return url.slice(0, end)
}

export function citedSourceUrls(text: string) {
  return (text.match(URL_PATTERN) || []).map(stripTrailing)
}

/**
 * One key per page: scheme, www., a #fragment and a trailing slash do not
 * change the page. Exact matching failed valid citations for nothing.
 */
export function sameSourcePage(url: string) {
  const trimmed = stripTrailing(url.trim())
  const match = /^https?:\/\/([^/?#]+)([^#]*)/i.exec(trimmed)
  if (!match) {
    return trimmed
  }
  const rest = match[2] || ''
  const queryAt = rest.indexOf('?')
  const path = queryAt === -1 ? rest : rest.slice(0, queryAt)
  const query = queryAt === -1 ? '' : rest.slice(queryAt)
  return match[1]!.toLowerCase().replace(/^www\./, '') + path.replace(/\/+$/, '') + query
}

export function bannedLanguage(text: string) {
  const found: string[] = []
  if (DASH.test(text)) {
    found.push('emdash or double hyphen')
  }
  const demand = DEMAND.exec(text)
  if (demand) {
    found.push(`demand phrase "${demand[0]}"`)
  }
  return found
}

export function scriptWords(script: ClaudemyTurn[]) {
  return script.reduce((total, turn) => total + turn.text.split(/\s+/).filter(Boolean).length, 0)
}

function checkScript(script: ClaudemyTurn[]) {
  const problems: string[] = []
  const words = scriptWords(script)

  if (script.length < 6) {
    problems.push(`only ${script.length} turns; a two-host conversation needs more back and forth`)
  }
  if (!script.some(turn => turn.speaker === 'A') || !script.some(turn => turn.speaker === 'B')) {
    problems.push('both hosts, A and B, have to speak')
  }
  const broken = script.filter(turn => !turn.text.trim() || /\n/.test(turn.text))
  if (broken.length) {
    problems.push(`${broken.length} turns are empty or run over several lines`)
  }
  if (words < CLAUDEMY_SCRIPT_WORDS.min || words > CLAUDEMY_SCRIPT_WORDS.max) {
    problems.push(
      `${words} words, want ${CLAUDEMY_SCRIPT_WORDS.min} to ${CLAUDEMY_SCRIPT_WORDS.max} (about 2 minutes)`
    )
  }

  const tags = script.flatMap(turn => turn.text.match(TAG) || [])
  if (tags.length > TAGS_MAX) {
    problems.push(`${tags.length} audio tags, max ${TAGS_MAX}`)
  }
  for (const turn of script) {
    for (const tag of turn.text.match(TAG) || []) {
      if (!ALLOWED_TAGS.has(tag) || !turn.text.trimStart().startsWith(tag)) {
        problems.push(`audio tag ${tag} is not [laughs], [chuckles] or [sighs] at the start of a turn`)
      }
    }
  }

  const spoken = script.map(turn => turn.text).join('\n')
  problems.push(...bannedLanguage(spoken).map(problem => `script: ${problem}`))
  return { problems, words }
}

function cardText(card: ClaudemyCard) {
  return [
    ...card.ideaLines,
    card.impact,
    card.whoSaysIt,
    card.tryIt.steps,
    card.rule,
    ...card.deeper.flatMap(link => [link.label, link.url])
  ].join('\n')
}

function checkCard(card: ClaudemyCard, knownUrls: Iterable<string>, counts: { agree: number; of: number }[]) {
  const problems: string[] = []

  if (card.ideaLines.length !== 3) {
    problems.push(`card needs exactly three idea lines (has ${card.ideaLines.length})`)
  }
  const required: [string, string][] = [
    ['impact', card.impact],
    ['who says it', card.whoSaysIt],
    ['try it', card.tryIt.steps],
    ['rule to keep', card.rule]
  ]
  for (const [label, value] of required) {
    if (!value.trim()) {
      problems.push(`card is missing ${label}`)
    }
  }
  if (card.tryIt.minutes < 2 || card.tryIt.minutes > 15) {
    problems.push(`try it takes ${card.tryIt.minutes} minutes, want 2 to 15`)
  }

  const text = cardText(card)
  problems.push(...bannedLanguage(text).map(problem => `card: ${problem}`))

  const cited = citedSourceUrls(text)
  if (!cited.length) {
    problems.push('card cites no source')
  }
  const known = new Set([...knownUrls].map(sameSourcePage))
  for (const url of new Set(cited)) {
    if (!known.has(sameSourcePage(url))) {
      problems.push(`card cites a page the class never read: ${url}`)
    }
  }

  // "9 of 14" on the card has to be a count the agreement map actually made.
  for (const [, agree, of] of card.whoSaysIt.matchAll(/(\d+) of (\d+)/g)) {
    const claimed = { agree: Number(agree), of: Number(of) }
    if (counts.length && !counts.some(count => count.agree === claimed.agree && count.of === claimed.of)) {
      const actual = counts.map(count => `${count.agree} of ${count.of}`).join(' or ')
      problems.push(`card says "${agree} of ${of}" but the agreement map counts ${actual}`)
    }
  }

  return problems
}

export function checkClaudemyLesson(
  lesson: { script: ClaudemyTurn[]; card: ClaudemyCard },
  knownUrls: Iterable<string>,
  counts: { agree: number; of: number }[] = []
) {
  const script = checkScript(lesson.script)
  return {
    words: script.words,
    problems: [...script.problems, ...checkCard(lesson.card, knownUrls, counts)]
  }
}

/**
 * N of M for one theme. M is the distinct sources with any note on the
 * theme's sub-topics (their "Also" lines included), the ones that had a
 * chance to say it; N is how many of those support it. Sources are counted,
 * not notes: three notes from one page are one source.
 */
export function countAgreement(
  subtopics: string[],
  noteIds: string[],
  notes: (Pick<ClaudemyNote, 'id' | 'subtopic' | 'also'> & { source: number })[]
) {
  const byId = new Map(notes.map(note => [note.id, note]))
  const support = new Set<number>()
  for (const id of noteIds) {
    const note = byId.get(id)
    if (note) {
      support.add(note.source)
    }
  }

  const covered = new Set(support)
  for (const note of notes) {
    if ([note.subtopic, ...note.also].some(id => subtopics.includes(id))) {
      covered.add(note.source)
    }
  }

  return { agree: support.size, of: covered.size, thin: covered.size < 3 }
}

/** List price of Claude Opus 5.5 and web search; a fallback model bills at its own rate. */
export function estimateClaudemyCost(usage: { inputTokens: number; outputTokens: number; webSearches: number }) {
  return (usage.inputTokens * 4 + usage.outputTokens * 20) / 1_000_000 + usage.webSearches * 0.01
}

/** Spoken by the browser voice: audio tags are direction, not words. */
export function spokenLine(text: string) {
  return text.replace(TAG, '').replace(/\s+/g, ' ').trim()
}

export function claudemyCardMarkdown(lesson: ClaudemyLessonRecord) {
  const card = lesson.card
  if (!card) {
    return ''
  }
  const minutes = Math.max(1, Math.round(lesson.words / 150))
  return [
    `# Lesson ${lesson.number}. ${lesson.handle}`,
    '',
    `**Listen:** in the app (about ${minutes} min)`,
    '',
    '**The idea, in three lines**',
    ...card.ideaLines.map(line => `- ${line}`),
    '',
    `**Impact:** ${card.impact}`,
    '',
    `**Who says it:** ${card.whoSaysIt}`,
    '',
    `**Try it** · ${card.tryIt.energy} · ${card.tryIt.minutes} min`,
    card.tryIt.steps,
    '',
    '**Rule to keep**',
    card.rule,
    '',
    `**Skip** · no cost, no catch-up. Lesson ${lesson.number + 1} is just lesson ${lesson.number + 1}.`,
    '',
    '**Go deeper (optional)**',
    ...card.deeper.map(link => `- ${link.label}: ${link.url}`)
  ].join('\n')
}
