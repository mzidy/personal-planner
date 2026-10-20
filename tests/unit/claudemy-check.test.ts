import { describe, expect, it } from 'vitest'
import type { ClaudemyCard, ClaudemyTurn } from '../../shared/types/claudemy'
import {
  bannedLanguage,
  checkClaudemyLesson,
  citedSourceUrls,
  countAgreement,
  sameSourcePage,
  spokenLine
} from '../../shared/utils/claudemy-check'
import { extractReadableText } from '../../server/utils/page-reader'

const READ = ['https://example.org/pricing/three-options', 'https://www.coach.example/blog/anchoring/']

function script(totalWords: number): ClaudemyTurn[] {
  const turns: ClaudemyTurn[] = []
  let left = totalWords
  let speaker: 'A' | 'B' = 'A'
  while (left > 0) {
    const size = Math.min(20, left)
    turns.push({ speaker, text: Array.from({ length: size }, () => 'word').join(' ') })
    left -= size
    speaker = speaker === 'A' ? 'B' : 'A'
  }
  return turns
}

function card(overrides: Partial<ClaudemyCard> = {}): ClaudemyCard {
  return {
    ideaLines: ['One price asks "is this worth it?"', 'Three options ask "which is best?"', 'Biggest first.'],
    impact: 'Every quote has room above it.',
    whoSaysIt: '9 of 14 pricing sources agree. Two prefer a single range.',
    tryIt: { energy: 'Quick Win', minutes: 10, steps: 'Split your last quote into three doors.' },
    rule: 'Every price comes as three named options.',
    deeper: [{ label: 'On options', url: 'https://example.org/pricing/three-options' }],
    ...overrides
  }
}

describe('sameSourcePage', () => {
  it('ignores scheme, www, fragment and a trailing slash, but keeps the query', () => {
    expect(sameSourcePage('http://www.Coach.example/blog/anchoring#top')).toBe(
      sameSourcePage('https://coach.example/blog/anchoring/')
    )
    expect(sameSourcePage('https://a.example/p?id=2')).not.toBe(sameSourcePage('https://a.example/p?id=3'))
  })
})

describe('citedSourceUrls', () => {
  it('drops punctuation that trails a url in prose and keeps balanced parentheses', () => {
    expect(citedSourceUrls('See https://example.org/a. And https://en.wikipedia.org/wiki/Mercury_(planet), too.')).toEqual([
      'https://example.org/a',
      'https://en.wikipedia.org/wiki/Mercury_(planet)'
    ])
  })
})

describe('bannedLanguage', () => {
  it('refuses demand phrases and dashes, and allows describing a situation', () => {
    expect(bannedLanguage('You should try it')).toEqual(['demand phrase "You should"'])
    expect(bannedLanguage('Don’t forget the receipt')).toEqual(['demand phrase "Don’t forget"'])
    expect(bannedLanguage('a pause — then the offer')).toEqual(['emdash or double hyphen'])
    expect(bannedLanguage('Both sides have to say yes.')).toEqual([])
  })
})

describe('checkClaudemyLesson', () => {
  it('passes a two-host script of about two minutes with a card that cites a page the class read', () => {
    const result = checkClaudemyLesson({ script: script(300), card: card() }, READ, [{ agree: 9, of: 14 }])
    expect(result.problems).toEqual([])
    expect(result.words).toBe(300)
  })

  it('refuses a card that cites a page the class never read', () => {
    const result = checkClaudemyLesson(
      { script: script(300), card: card({ deeper: [{ label: 'Made up', url: 'https://invented.example/post' }] }) },
      READ
    )
    expect(result.problems).toContain('card cites a page the class never read: https://invented.example/post')
  })

  it('matches a citation to its page despite www and a trailing slash', () => {
    const result = checkClaudemyLesson(
      { script: script(300), card: card({ deeper: [{ label: 'Anchoring', url: 'https://coach.example/blog/anchoring' }] }) },
      READ
    )
    expect(result.problems).toEqual([])
  })

  it('refuses a script outside the two-minute band', () => {
    expect(checkClaudemyLesson({ script: script(200), card: card() }, READ).problems).toContain(
      '200 words, want 280 to 350 (about 2 minutes)'
    )
    expect(checkClaudemyLesson({ script: script(400), card: card() }, READ).problems).toContain(
      '400 words, want 280 to 350 (about 2 minutes)'
    )
  })

  it('refuses audio tags that are not allowed or not at the start of a turn', () => {
    const turns = script(300)
    turns[1] = { speaker: 'B', text: `${turns[1]!.text} [gasps]` }
    const { problems } = checkClaudemyLesson({ script: turns, card: card() }, READ)
    expect(problems).toContain('audio tag [gasps] is not [laughs], [chuckles] or [sighs] at the start of a turn')
  })

  it('refuses an agreement count the map never made', () => {
    const { problems } = checkClaudemyLesson({ script: script(300), card: card() }, READ, [{ agree: 7, of: 12 }])
    expect(problems).toContain('card says "9 of 14" but the agreement map counts 7 of 12')
  })

  it('refuses demand language on the card and a try-it longer than fifteen minutes', () => {
    const { problems } = checkClaudemyLesson(
      { script: script(300), card: card({ rule: 'You must always quote three options.', tryIt: { energy: 'Deep Focus', minutes: 45, steps: 'Rewrite every quote.' } }) },
      READ
    )
    expect(problems).toContain('card: demand phrase "You must"')
    expect(problems).toContain('try it takes 45 minutes, want 2 to 15')
  })
})

describe('countAgreement', () => {
  const notes = [
    { id: 'S1.N1', source: 1, subtopic: 'T01', also: [] },
    { id: 'S1.N2', source: 1, subtopic: 'T01', also: [] },
    { id: 'S2.N1', source: 2, subtopic: 'T01', also: [] },
    { id: 'S3.N1', source: 3, subtopic: 'T02', also: ['T01'] },
    { id: 'S4.N1', source: 4, subtopic: 'T05', also: [] }
  ]

  it('counts sources, not notes, and includes "also" lines in what was covered', () => {
    expect(countAgreement(['T01'], ['S1.N1', 'S1.N2', 'S2.N1'], notes)).toEqual({ agree: 2, of: 3, thin: false })
  })

  it('marks a theme thin when fewer than three sources covered its ground', () => {
    expect(countAgreement(['T05'], ['S4.N1'], notes)).toEqual({ agree: 1, of: 1, thin: true })
  })

  it('ignores note ids that do not exist', () => {
    expect(countAgreement(['T01'], ['S9.N9'], notes)).toEqual({ agree: 0, of: 3, thin: false })
  })
})

describe('spokenLine', () => {
  it('leaves audio tags out of what the voice says', () => {
    expect(spokenLine('[laughs] Big claim. Go.')).toBe('Big claim. Go.')
  })
})

describe('extractReadableText', () => {
  it('keeps the article and drops scripts, navigation and entities', () => {
    const body = Array.from({ length: 40 }, (_, index) => `<p>Paragraph ${index} about pricing &amp; options.</p>`).join('')
    const html = `<html><head><title>Three doors &ndash; pricing</title><script>var x = 1</script></head>
      <body><nav>Home About</nav><article><h1>Three doors</h1>${body}</article><footer>Footer</footer></body></html>`
    const { title, text } = extractReadableText(html)
    expect(title).toBe('Three doors – pricing')
    expect(text.startsWith('Three doors\nParagraph 0 about pricing & options.')).toBe(true)
    expect(text).not.toContain('var x')
    expect(text).not.toContain('Home About')
    expect(text).not.toContain('Footer')
  })
})
