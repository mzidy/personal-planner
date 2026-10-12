/**
 * The command library behind Voice control.
 *
 * Matching is done here, locally, against a fixed set of phrasings — there is
 * no model and no request. Each command declares the phrases that introduce it
 * and how to turn the rest of the sentence into a request body.
 *
 * Every command is additive. Nothing here deletes or overwrites, because
 * speech recognition mishears and an action triggered by a misheard phrase has
 * to be harmless.
 *
 * Adding a command is one entry in VOICE_COMMANDS; the page lists them and the
 * matcher picks them up with no further changes.
 */

export interface VoiceAction {
  /** API path to POST to. */
  endpoint: string
  body: Record<string, unknown>
  /** What was understood, shown back before and after running. */
  summary: string
}

export interface VoiceCommand {
  key: string
  label: string
  /** Shown in the list of what it understands. */
  example: string
  /** Lower-case phrases that introduce the command, longest matched first. */
  triggers: string[]
  /** Builds the request from whatever followed the trigger. */
  build: (rest: string, raw: string) => VoiceAction | null
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim().replace(/[.,!?]+$/, '')
}

function capitalise(value: string) {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value
}

/** Spoken numbers that commonly appear in these commands, in both languages. */
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  nic: 0, ena: 1, dve: 2, tri: 3, stiri: 4, pet: 5, sest: 6, sedem: 7,
  osem: 8, devet: 9, deset: 10, enajst: 11, dvanajst: 12
}

/**
 * Strips Slovenian diacritics so č/š/ž match their plain forms. Dictation and
 * typing disagree about them constantly, and no command depends on the
 * distinction.
 */
export function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function parseNumber(value: string): number | null {
  const text = value.trim().toLowerCase()

  // "eighty five point five" is beyond this; a spoken digit string is not.
  const direct = Number(text.replace(/,/g, '.').replace(/[^\d.-]/g, ''))
  if (text && Number.isFinite(direct) && /\d/.test(text)) {
    return direct
  }

  const word = NUMBER_WORDS[fold(text)]
  return word === undefined ? null : word
}

const URGENCY_WORDS: Record<string, string> = {
  critical: 'critical',
  urgent: 'critical',
  high: 'high',
  important: 'high',
  medium: 'medium',
  normal: 'medium',
  low: 'low',
  // Slovenian, diacritics folded away before lookup.
  kriticno: 'critical',
  nujno: 'critical',
  visoka: 'high',
  visoko: 'high',
  pomembno: 'high',
  srednja: 'medium',
  srednje: 'medium',
  nizka: 'low',
  nizko: 'low'
}

/** Pulls a trailing "... high priority" or "... priority high" off a title. */
function extractUrgency(text: string) {
  const match = text.match(
    /\b(?:priority\s+([\p{L}]+)|([\p{L}]+)\s+priority|prioriteta\s+([\p{L}]+)|([\p{L}]+)\s+prioriteta)\s*$/iu
  )
  if (!match) {
    return { title: text, urgency: 'medium' }
  }

  const word = fold(match[1] || match[2] || match[3] || match[4] || '')
  const urgency = URGENCY_WORDS[word]
  if (!urgency) {
    return { title: text, urgency: 'medium' }
  }

  return { title: clean(text.slice(0, match.index)), urgency }
}

const SHOPPING_HORIZONS: Record<string, string> = {
  'short term': 'short',
  'short-term': 'short',
  soon: 'short',
  'medium term': 'medium',
  'medium-term': 'medium',
  'long term': 'long',
  'long-term': 'long',
  later: 'long',
  kratkorocno: 'short',
  srednjerocno: 'medium',
  dolgorocno: 'long'
}

export const VOICE_COMMANDS: VoiceCommand[] = [
  {
    key: 'note',
    label: 'Add a note',
    example: '"Add a note the boiler service is due" · "Dodaj zapisek servis peči zapade marca"',
    triggers: [
      'add a note', 'add note', 'new note', 'note that', 'take a note',
      'dodaj zapisek', 'nov zapisek', 'zapisi si', 'zabelezi', 'zapisek'
    ],
    build: rest => {
      const body = clean(rest)
      if (!body) return null
      return {
        endpoint: '/api/notes',
        body: { body: capitalise(body), source: 'manual' },
        summary: `Note: ${capitalise(body)}`
      }
    }
  },
  {
    key: 'task',
    label: 'Add a task',
    example: '"Add a task finish the fence high priority" · "Dodaj nalogo dokončaj ograjo visoka prioriteta"',
    triggers: [
      'add a task', 'add task', 'new task', 'remind me to', 'i need to',
      'dodaj nalogo', 'nova naloga', 'spomni me', 'opravilo'
    ],
    build: rest => {
      const { title, urgency } = extractUrgency(clean(rest))
      if (!title) return null
      return {
        endpoint: '/api/priorities',
        body: {
          title: capitalise(title),
          detail: '',
          status: 'focus',
          urgency,
          focusWindow: 'Morning deep work'
        },
        summary: `Task: ${capitalise(title)} (${urgency})`
      }
    }
  },
  {
    key: 'shopping',
    label: 'Add to the shopping list',
    example: '"Add to shopping list a drill long term" · "Kupi oljčno olje"',
    triggers: [
      'add to shopping list', 'add to the shopping list', 'add to shopping', 'buy',
      'dodaj na nakupovalni seznam', 'dodaj na seznam', 'kupi'
    ],
    build: rest => {
      let text = clean(rest)
      let horizon = 'short'

      /*
       * Tested against the folded copy so "dolgoročno" matches the key written
       * "dolgorocno", but cut from the original so the item keeps its own
       * spelling. Both strings are NFC, so the offset is valid in either.
       */
      const folded = fold(text)
      for (const [phrase, value] of Object.entries(SHOPPING_HORIZONS)) {
        const suffix = new RegExp(`\\s+${phrase}\\s*$`, 'i')
        const found = folded.match(suffix)
        if (found && found.index !== undefined) {
          horizon = value
          text = clean(text.slice(0, found.index))
          break
        }
      }

      if (!text) return null
      return {
        endpoint: '/api/shopping/items',
        body: { name: capitalise(text), horizon },
        summary: `Shopping (${horizon}): ${capitalise(text)}`
      }
    }
  },
  {
    key: 'weight',
    label: 'Log a weigh-in',
    example: '"Log weight 85.4" · "Moja teža je 85,4"',
    triggers: [
      'log weight', 'log my weight', 'record weight', 'weigh in', 'weight is',
      'zabelezi tezo', 'teza je', 'moja teza je'
    ],
    build: rest => {
      const value = parseNumber(clean(rest).replace(/\b(kilos?|kilograms?|kilogramov|kil|kg)\b/gi, ''))
      if (value === null || value < 25 || value > 400) return null
      return {
        endpoint: '/api/stats/weigh-ins',
        body: { weightKg: value },
        summary: `Weigh-in: ${value} kg`
      }
    }
  },
  {
    key: 'diary',
    label: 'Add a diary entry',
    example: '"Add a diary entry today went well" · "Dodaj v dnevnik danes je šlo bolje"',
    triggers: [
      'add a diary entry', 'add diary entry', 'diary entry', 'journal that',
      'dodaj v dnevnik', 'zapisi v dnevnik', 'dnevniski vnos'
    ],
    build: rest => {
      const body = clean(rest)
      if (!body) return null
      return {
        endpoint: '/api/journal',
        body: {
          title: capitalise(body.split(' ').slice(0, 6).join(' ')),
          body: capitalise(body),
          prompt: 'Voice capture',
          focusTag: 'voice'
        },
        summary: `Diary: ${capitalise(body)}`
      }
    }
  },
  {
    key: 'routine',
    label: 'Add a daily routine item',
    example: '"Add a routine twenty minutes of reading" · "Dodaj rutino dvajset minut branja"',
    triggers: [
      'add a routine', 'add routine', 'new routine',
      'dodaj rutino', 'nova rutina'
    ],
    build: rest => {
      const description = clean(rest)
      if (!description) return null
      return {
        endpoint: '/api/routine/entries',
        body: { description: capitalise(description) },
        summary: `Routine: ${capitalise(description)}`
      }
    }
  }
]

export interface VoiceMatch {
  command: VoiceCommand
  action: VoiceAction
}

export interface VoiceMatchFailure {
  /** The command was recognised but its argument was missing or unusable. */
  command: VoiceCommand | null
  reason: string
}

/**
 * Longest trigger first, so "add a note" is not swallowed by a shorter phrase
 * that happens to be a prefix of it.
 */
const SORTED = VOICE_COMMANDS.flatMap(command =>
  command.triggers.map(trigger => ({ command, trigger }))
).sort((a, b) => b.trigger.length - a.trigger.length)

export function matchVoiceCommand(transcript: string): VoiceMatch | VoiceMatchFailure {
  /*
   * Composed first, then folded. Triggers are written without diacritics
   * because dictation and typing disagree about them constantly — but the
   * argument must keep its own, so the folded copy is only used to find the
   * trigger and the offset is applied to the composed original. Composing
   * first is what keeps those two in step: folding decomposes, and a
   * decomposed input would otherwise be longer than its folded form and the
   * slice would cut in the wrong place.
   */
  const composed = clean(transcript).normalize('NFC')
  const text = fold(composed)

  if (!text) {
    return { command: null, reason: 'Nothing was heard.' }
  }

  for (const { command, trigger } of SORTED) {
    if (text === trigger || text.startsWith(`${trigger} `)) {
      const rest = composed.slice(trigger.length)
      const action = command.build(rest, composed)

      if (action) {
        return { command, action }
      }
      return { command, reason: `Heard "${command.label.toLowerCase()}" but not what to add.` }
    }
  }

  return { command: null, reason: 'That did not match any command.' }
}

export function isVoiceMatch(result: VoiceMatch | VoiceMatchFailure): result is VoiceMatch {
  return 'action' in result
}
