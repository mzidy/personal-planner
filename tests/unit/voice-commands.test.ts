import { describe, expect, it } from 'vitest'
import {
  VOICE_COMMANDS,
  isVoiceMatch,
  matchVoiceCommand,
  parseNumber
} from '../../shared/utils/voice-commands'

/** Narrows to a match or fails the test with the reason it did not match. */
function match(transcript: string) {
  const result = matchVoiceCommand(transcript)
  if (!isVoiceMatch(result)) {
    throw new Error(`Expected a match for "${transcript}", got: ${result.reason}`)
  }
  return result
}

describe('parseNumber', () => {
  it('reads digits, including decimals written with a comma', () => {
    expect(parseNumber('85')).toBe(85)
    expect(parseNumber('85.4')).toBe(85.4)
    expect(parseNumber('85,4')).toBe(85.4)
  })

  it('reads the small spoken numbers', () => {
    expect(parseNumber('three')).toBe(3)
    expect(parseNumber('TWELVE')).toBe(12)
  })

  it('returns null for anything else', () => {
    expect(parseNumber('a lot')).toBeNull()
    expect(parseNumber('')).toBeNull()
  })
})

describe('notes', () => {
  it('captures everything after the trigger', () => {
    const { action } = match('Add a note the boiler service is due in March')
    expect(action.endpoint).toBe('/api/notes')
    expect(action.body.body).toBe('The boiler service is due in March')
    expect(action.body.source).toBe('manual')
  })

  it('drops trailing punctuation from dictation', () => {
    expect(match('note that the keys are in the drawer.').action.body.body).toBe(
      'The keys are in the drawer'
    )
  })
})

describe('tasks', () => {
  it('defaults to medium urgency', () => {
    const { action } = match('add a task paint the shed')
    expect(action.endpoint).toBe('/api/priorities')
    expect(action.body.title).toBe('Paint the shed')
    expect(action.body.urgency).toBe('medium')
  })

  it('reads a trailing priority and keeps it out of the title', () => {
    const { action } = match('add a task finish the fence high priority')
    expect(action.body.title).toBe('Finish the fence')
    expect(action.body.urgency).toBe('high')
  })

  it('accepts the other word order and synonyms', () => {
    expect(match('add a task call the dentist priority urgent').action.body.urgency).toBe('critical')
    expect(match('remind me to water the plants low priority').action.body.urgency).toBe('low')
  })

  it('does not mistake an ordinary trailing word for a priority', () => {
    const { action } = match('add a task review the quarterly report')
    expect(action.body.title).toBe('Review the quarterly report')
    expect(action.body.urgency).toBe('medium')
  })
})

describe('shopping', () => {
  it('defaults to the short horizon', () => {
    const { action } = match('buy olive oil')
    expect(action.endpoint).toBe('/api/shopping/items')
    expect(action.body).toMatchObject({ name: 'Olive oil', horizon: 'short' })
  })

  it('reads a trailing horizon and strips it from the name', () => {
    expect(match('add to shopping list a new drill long term').action.body).toMatchObject({
      name: 'A new drill',
      horizon: 'long'
    })
    expect(match('buy a winter coat medium term').action.body).toMatchObject({
      name: 'A winter coat',
      horizon: 'medium'
    })
  })
})

describe('weigh-ins', () => {
  it('reads the number and ignores the unit', () => {
    expect(match('log weight 85.4 kg').action.body).toEqual({ weightKg: 85.4 })
    expect(match('weight is 90 kilograms').action.body).toEqual({ weightKg: 90 })
  })

  it('refuses a value outside the plausible range rather than posting it', () => {
    const result = matchVoiceCommand('log weight 850')
    expect(isVoiceMatch(result)).toBe(false)
  })

  it('refuses when no number was heard', () => {
    const result = matchVoiceCommand('log weight quite a lot')
    expect(isVoiceMatch(result)).toBe(false)
  })
})

describe('matching', () => {
  it('prefers the longest trigger', () => {
    // "add to shopping" and "add to shopping list" both match; the longer wins,
    // otherwise "list" would end up in the item name.
    expect(match('add to shopping list bread').action.body.name).toBe('Bread')
  })

  it('reports an unknown phrase without guessing', () => {
    const result = matchVoiceCommand('what is the weather like')
    expect(isVoiceMatch(result)).toBe(false)
    if (!isVoiceMatch(result)) {
      expect(result.command).toBeNull()
    }
  })

  it('names the command when only its argument is missing', () => {
    const result = matchVoiceCommand('add a note')
    expect(isVoiceMatch(result)).toBe(false)
    if (!isVoiceMatch(result)) {
      expect(result.command?.key).toBe('note')
    }
  })

  it('handles an empty transcript', () => {
    expect(isVoiceMatch(matchVoiceCommand('   '))).toBe(false)
  })

  it('is case insensitive', () => {
    expect(match('ADD A NOTE Shouting Works').action.body.body).toBe('Shouting Works')
  })
})

describe('the library itself', () => {
  it('has no destructive commands — every one posts', () => {
    for (const command of VOICE_COMMANDS) {
      const action = command.build('something plausible 85', 'x')
      if (action) {
        expect(action.endpoint.startsWith('/api/')).toBe(true)
      }
    }
  })

  it('gives every command a unique key and at least one trigger', () => {
    const keys = VOICE_COMMANDS.map(command => command.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const command of VOICE_COMMANDS) {
      expect(command.triggers.length).toBeGreaterThan(0)
      expect(command.example).toBeTruthy()
    }
  })
})

describe('Slovenian', () => {
  it('adds a note and keeps the diacritics in the text', () => {
    const { action } = match('Dodaj zapisek servis peči zapade marca')
    expect(action.endpoint).toBe('/api/notes')
    expect(action.body.body).toBe('Servis peči zapade marca')
  })

  it('matches a trigger spoken with diacritics against its folded form', () => {
    // The trigger is written "zapisi v dnevnik"; this is said with the č/š.
    const { action } = match('Zapiši v dnevnik danes je šlo bolje')
    expect(action.endpoint).toBe('/api/journal')
    expect(action.body.body).toBe('Danes je šlo bolje')
  })

  it('survives a decomposed transcript without eating a character', () => {
    // Some input sources hand over NFD; folding shortens it, so the offset
    // used to slice the argument has to be taken from the composed form.
    const decomposed = 'Dodaj zapisek oljčno olje'.normalize('NFD')
    expect(match(decomposed).action.body.body).toBe('Oljčno olje')
  })

  it('reads a Slovenian priority and keeps it out of the title', () => {
    const { action } = match('dodaj nalogo dokončaj ograjo visoka prioriteta')
    expect(action.body.title).toBe('Dokončaj ograjo')
    expect(action.body.urgency).toBe('high')
    expect(match('dodaj nalogo pokliči zobozdravnika prioriteta nujno').action.body.urgency).toBe(
      'critical'
    )
  })

  it('adds to the shopping list, with a Slovenian horizon', () => {
    expect(match('kupi oljčno olje').action.body).toMatchObject({
      name: 'Oljčno olje',
      horizon: 'short'
    })
    expect(match('dodaj na seznam nov vrtalnik dolgoročno').action.body).toMatchObject({
      name: 'Nov vrtalnik',
      horizon: 'long'
    })
  })

  it('reads a weigh-in with a comma decimal and a Slovenian unit', () => {
    expect(match('moja teža je 85,4 kilogramov').action.body).toEqual({ weightKg: 85.4 })
  })

  it('reads a Slovenian spoken number', () => {
    expect(parseNumber('tri')).toBe(3)
    expect(parseNumber('štiri')).toBe(4)
  })

  it('adds a routine', () => {
    expect(match('dodaj rutino dvajset minut branja').action.body.description).toBe(
      'Dvajset minut branja'
    )
  })
})
