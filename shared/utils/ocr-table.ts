/**
 * Reconstructs a table from OCR word positions.
 *
 * OCR returns words with bounding boxes but no notion of a table. Columns are
 * recovered from the *gutters* — vertical bands the width of the image that no
 * word occupies. Clustering on the left edge of each word would be simpler, but
 * it breaks on right-aligned columns (numbers), where the left edges do not line
 * up at all; a gutter sits between the columns regardless of how either side is
 * aligned.
 *
 * Pure functions, no DOM: the detection is the part worth testing.
 */

export interface OcrWord {
  text: string
  /** Pixel bounds in the source image. */
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

/** One OCR text line, already grouped by the engine. */
export interface OcrLine {
  words: OcrWord[]
}

export interface TableDetection {
  /** Rows of cell text; every row has the same length. */
  rows: string[][]
  columnCount: number
  /** False when the layout does not look like a table at all. */
  isTable: boolean
  reason: string
}

function median(values: number[]) {
  if (!values.length) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/**
 * Vertical bands wider than `minimumGap` that no word crosses, returned as the
 * x midpoints that separate the columns.
 */
export function findColumnBoundaries(words: OcrWord[], minimumGap: number): number[] {
  if (words.length < 2) {
    return []
  }

  const spans = words
    .map(word => ({ start: word.bbox.x0, end: word.bbox.x1 }))
    .sort((a, b) => a.start - b.start)

  const boundaries: number[] = []
  let reach = spans[0]!.end

  for (const span of spans.slice(1)) {
    if (span.start - reach > minimumGap) {
      boundaries.push((reach + span.start) / 2)
    }
    reach = Math.max(reach, span.end)
  }

  return boundaries
}

function columnIndexFor(word: OcrWord, boundaries: number[]) {
  const centre = (word.bbox.x0 + word.bbox.x1) / 2
  let index = 0
  while (index < boundaries.length && centre > boundaries[index]!) {
    index += 1
  }
  return index
}

/**
 * @param minimumGapRatio how wide a gutter must be, as a multiple of the median
 *   word height. Roughly "wider than a couple of spaces".
 */
export function detectTable(lines: OcrLine[], minimumGapRatio = 1.2): TableDetection {
  const populated = lines.filter(line => line.words.some(word => word.text.trim()))

  if (populated.length < 2) {
    return { rows: [], columnCount: 0, isTable: false, reason: 'Not enough lines of text.' }
  }

  const allWords = populated.flatMap(line => line.words.filter(word => word.text.trim()))
  const heights = allWords.map(word => word.bbox.y1 - word.bbox.y0).filter(height => height > 0)
  const minimumGap = Math.max(8, median(heights) * minimumGapRatio)

  const boundaries = findColumnBoundaries(allWords, minimumGap)
  const columnCount = boundaries.length + 1

  if (columnCount < 2) {
    return {
      rows: populated.map(line => [line.words.map(word => word.text).join(' ').trim()]),
      columnCount: 1,
      isTable: false,
      reason: 'No column gaps found — this looks like plain text.'
    }
  }

  const rows = populated.map(line => {
    const cells: string[][] = Array.from({ length: columnCount }, () => [])
    for (const word of line.words) {
      if (!word.text.trim()) {
        continue
      }
      cells[columnIndexFor(word, boundaries)]!.push(word.text)
    }
    return cells.map(cell => cell.join(' ').trim())
  })

  // A table whose rows almost all have a single filled cell is really a list
  // that happened to have one wide gap in it.
  const filledPerRow = rows.map(row => row.filter(Boolean).length)
  const multiCellRows = filledPerRow.filter(count => count > 1).length

  if (multiCellRows < Math.ceil(rows.length / 2)) {
    return {
      rows: populated.map(line => [line.words.map(word => word.text).join(' ').trim()]),
      columnCount: 1,
      isTable: false,
      reason: 'Most lines only fill one column — treating it as plain text.'
    }
  }

  return {
    rows,
    columnCount,
    isTable: true,
    reason: `${rows.length} rows × ${columnCount} columns.`
  }
}

/** Flattens OCR blocks into the lines this module works with. */
export function linesFromBlocks(blocks: unknown): OcrLine[] {
  const list = Array.isArray(blocks) ? blocks : []
  const lines: OcrLine[] = []

  for (const block of list as { paragraphs?: { lines?: { words?: OcrWord[] }[] }[] }[]) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        lines.push({ words: (line.words || []).filter(word => word?.bbox && typeof word.text === 'string') })
      }
    }
  }

  return lines
}

/** Tab-separated text, for the plain-text body kept alongside a table. */
export function tableToText(rows: string[][]) {
  return rows.map(row => row.join('\t')).join('\n')
}

export function tableToCsv(rows: string[][]) {
  return rows
    .map(row =>
      row
        .map(cell => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(',')
    )
    .join('\n')
}
