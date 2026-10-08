import { describe, expect, it } from 'vitest'
import {
  detectTable,
  findColumnBoundaries,
  tableToCsv,
  tableToText,
  type OcrLine
} from '../../shared/utils/ocr-table'

/** Builds a line of words at given x positions, all the same height. */
function line(entries: [text: string, x0: number, x1: number][], y = 0, height = 20): OcrLine {
  return {
    words: entries.map(([text, x0, x1]) => ({
      text,
      bbox: { x0, y0: y, x1, y1: y + height }
    }))
  }
}

describe('findColumnBoundaries', () => {
  it('finds the gap between two separated words', () => {
    const words = [
      { text: 'a', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
      { text: 'b', bbox: { x0: 200, y0: 0, x1: 250, y1: 20 } }
    ]
    expect(findColumnBoundaries(words, 20)).toEqual([125])
  })

  it('ignores gaps narrower than the threshold', () => {
    const words = [
      { text: 'a', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
      { text: 'b', bbox: { x0: 60, y0: 0, x1: 100, y1: 20 } }
    ]
    expect(findColumnBoundaries(words, 20)).toEqual([])
  })

  it('merges overlapping spans rather than reporting a false gap', () => {
    // A wide word spanning two narrower ones must not create a boundary.
    const words = [
      { text: 'wide', bbox: { x0: 0, y0: 0, x1: 300, y1: 20 } },
      { text: 'a', bbox: { x0: 10, y0: 30, x1: 40, y1: 50 } },
      { text: 'b', bbox: { x0: 250, y0: 30, x1: 290, y1: 50 } }
    ]
    expect(findColumnBoundaries(words, 20)).toEqual([])
  })
})

describe('detectTable', () => {
  const grid: OcrLine[] = [
    line([['Name', 40, 120], ['Qty', 300, 350], ['Price', 480, 560]], 30),
    line([['Apples', 40, 140], ['12', 300, 330], ['3.40', 480, 540]], 90),
    line([['Bread', 40, 130], ['2', 300, 320], ['2.10', 480, 540]], 150)
  ]

  it('recovers a three-column grid', () => {
    const result = detectTable(grid)
    expect(result.isTable).toBe(true)
    expect(result.columnCount).toBe(3)
    expect(result.rows).toEqual([
      ['Name', 'Qty', 'Price'],
      ['Apples', '12', '3.40'],
      ['Bread', '2', '2.10']
    ])
  })

  it('handles a right-aligned numeric column, where left edges do not line up', () => {
    const rightAligned: OcrLine[] = [
      line([['Item', 40, 110], ['Total', 460, 540]], 30),
      line([['Pens', 40, 100], ['7.00', 480, 540]], 90),
      line([['Notebooks', 40, 180], ['123.00', 440, 540]], 150)
    ]
    const result = detectTable(rightAligned)
    expect(result.isTable).toBe(true)
    expect(result.columnCount).toBe(2)
    expect(result.rows[2]).toEqual(['Notebooks', '123.00'])
  })

  it('keeps multi-word cells together', () => {
    const wordy: OcrLine[] = [
      line([['Full', 40, 90], ['name', 95, 150], ['Role', 400, 460]], 30),
      line([['Ada', 40, 85], ['Lovelace', 90, 190], ['Engineer', 400, 500]], 90)
    ]
    const result = detectTable(wordy)
    expect(result.rows[1]).toEqual(['Ada Lovelace', 'Engineer'])
  })

  it('reports plain prose as not a table', () => {
    const prose: OcrLine[] = [
      line([['Buy', 40, 80], ['milk', 85, 130], ['and', 135, 180], ['bread', 185, 250]], 30),
      line([['Call', 40, 85], ['the', 90, 125], ['dentist', 130, 210]], 90)
    ]
    const result = detectTable(prose)
    expect(result.isTable).toBe(false)
    expect(result.columnCount).toBe(1)
    expect(result.rows[0]).toEqual(['Buy milk and bread'])
  })

  it('does not call a list a table just because one line has a wide gap', () => {
    const list: OcrLine[] = [
      line([['First', 40, 100]], 30),
      line([['Second', 40, 120]], 90),
      line([['Third', 40, 110], ['far', 600, 650]], 150)
    ]
    expect(detectTable(list).isTable).toBe(false)
  })

  it('needs at least two lines', () => {
    expect(detectTable([line([['Alone', 40, 120]])]).isTable).toBe(false)
    expect(detectTable([]).isTable).toBe(false)
  })

  it('leaves a missing value as an empty cell rather than shifting the row', () => {
    const gappy: OcrLine[] = [
      line([['A', 40, 70], ['B', 300, 330], ['C', 480, 510]], 30),
      line([['x', 40, 70], ['z', 480, 510]], 90)
    ]
    const result = detectTable(gappy)
    expect(result.rows[1]).toEqual(['x', '', 'z'])
  })
})

describe('serialisation', () => {
  const rows = [
    ['Name', 'Note'],
    ['Ada', 'Said "hello", then left'],
    ['Bob', 'Line one\nLine two']
  ]

  it('joins cells with tabs for the plain-text body', () => {
    expect(tableToText([['a', 'b'], ['c', 'd']])).toBe('a\tb\nc\td')
  })

  it('quotes and escapes CSV cells that need it', () => {
    const csv = tableToCsv(rows)
    // Not split on newlines: a quoted cell may legitimately contain one.
    expect(csv.startsWith('Name,Note\n')).toBe(true)
    expect(csv).toContain('Ada,"Said ""hello"", then left"')
    expect(csv).toContain('Bob,"Line one\nLine two"')
  })
})
