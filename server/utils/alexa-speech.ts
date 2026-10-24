import type { UrgencyLevel } from '~~/shared/types/planner'
import type { VoiceAction } from '~~/shared/utils/voice-commands'

/** What Alexa says back. Kept apart from the handler so the wording can be tested. */

export const INVOCATION = 'serene planner'

export const HELP_SPEECH =
  'You can say: add milk to my shopping list, add a task call the plumber, take a note, ' +
  'my weight is eighty four point two, or what is on today.'

export const LINK_SPEECH =
  'This Alexa is not linked to your planner yet. In Serene, open Voice control and tap Link Alexa, ' +
  `then say: ask ${INVOCATION} to link, followed by the six digit code.`

export interface AlexaResponse {
  version: '1.0'
  response: {
    outputSpeech?: { type: 'PlainText'; text: string }
    reprompt?: { outputSpeech: { type: 'PlainText'; text: string } }
    shouldEndSession?: boolean
  }
}

export function speak(text: string, options: { reprompt?: string } = {}): AlexaResponse {
  return {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text },
      ...(options.reprompt ? { reprompt: { outputSpeech: { type: 'PlainText', text: options.reprompt } } } : {}),
      // Answer and finish, unless there is a question to answer.
      shouldEndSession: !options.reprompt
    }
  }
}

/** The confirmation for a command that was carried out. */
export function confirmation(key: string, action: VoiceAction) {
  const body = action.body as Record<string, unknown>
  switch (key) {
    case 'note':
      return `Noted: ${body.body}.`
    case 'task':
      return body.urgency && body.urgency !== 'medium' ? `Added the task ${body.title}, ${body.urgency} priority.` : `Added the task ${body.title}.`
    case 'shopping':
      return `Added ${body.name} to your shopping list.`
    case 'weight':
      return `Logged ${body.weightKg} kilos for this week.`
    case 'diary':
      return 'Added to your diary.'
    case 'routine':
      return `Added ${body.description} to your daily routine.`
    default:
      return 'Done.'
  }
}

const URGENCY_ORDER: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function list(items: string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function count(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`
}

/** "Today you have 2 scheduled blocks, 1 of 4 routine items done and 3 open tasks. …" */
export function todaySpeech(input: {
  blocks: number
  routineDone: number
  routineTotal: number
  tasks: { title: string; urgency: UrgencyLevel }[]
}) {
  const parts = [input.blocks ? count(input.blocks, 'scheduled block', 'scheduled blocks') : 'nothing on the calendar']
  if (input.routineTotal) {
    parts.push(`${input.routineDone} of ${count(input.routineTotal, 'routine item', 'routine items')} done`)
  }
  parts.push(input.tasks.length ? count(input.tasks.length, 'open task', 'open tasks') : 'no open tasks')

  let speech = `Today you have ${list(parts)}.`
  const urgent = [...input.tasks].sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]).slice(0, 3)
  if (urgent.length) {
    speech += urgent.length === 1 ? ` The one to do is ${urgent[0]!.title}.` : ` The most urgent are ${list(urgent.map(task => task.title))}.`
  }
  return speech
}

/** Six digits from however Alexa heard the code ("482913", "482 913"). */
export function linkCodeFrom(value: string | undefined) {
  const digits = (value || '').replace(/\D/g, '')
  return digits.length === 6 ? digits : null
}

/** "84" and "2" from "eighty four point two" → "84.2". */
export function weightFrom(kilos: string | undefined, decimal: string | undefined) {
  if (!kilos || !/^\d+$/.test(kilos)) {
    return null
  }
  return decimal && /^\d+$/.test(decimal) ? `${kilos}.${decimal}` : kilos
}
