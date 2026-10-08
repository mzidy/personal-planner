import type { NoteRecord } from '~~/shared/types/notes'

/**
 * Exports a table or a block of text as a spreadsheet or a PDF.
 *
 * The exporters take rows rather than a saved note, so the Import page can hand
 * over what it has just read from an image without saving it first.
 *
 * Both libraries are imported where they are used rather than at the top of the
 * module: together they are over a megabyte, and most visits never export
 * anything. That costs one dynamic import at click time.
 */
export interface ExportPayload {
  /** Rows of cells. A single cell per row is treated as plain text. */
  rows: string[][]
  /** Shown as the PDF title and used for the file name. */
  label: string
  /** ISO timestamp shown under the title; defaults to now. */
  createdAt?: string
  /** True when the first row should be rendered as a header. */
  isTable: boolean
}

/** A safe, recognisable file stem. */
function fileStem(label: string, createdAt: string) {
  const stamp = createdAt.slice(0, 16).replace(/[:T]/g, '-')
  const stem = label.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${stem || 'note'}-${stamp}`
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Turns a saved note into an export payload. */
export function payloadFromNote(note: NoteRecord): ExportPayload {
  return {
    rows: note.tableRows?.length ? note.tableRows : note.body.split('\n').map(line => [line]),
    label: note.sourceName || 'note',
    createdAt: note.createdAt,
    isTable: Boolean(note.tableRows?.length)
  }
}

export function useNoteExport() {
  async function exportXlsx(payload: ExportPayload) {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet(payload.rows)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Note')

    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    download(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${fileStem(payload.label, payload.createdAt || new Date().toISOString())}.xlsx`
    )
  }

  async function exportPdf(payload: ExportPayload) {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const autoTable = autoTableModule.default

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const createdAt = payload.createdAt || new Date().toISOString()
    const stamp = new Date(createdAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    doc.setFontSize(14)
    doc.text(payload.label || 'Note', 40, 48)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(stamp, 40, 64)
    doc.setTextColor(0)

    if (payload.isTable && payload.rows.length) {
      // The first row is treated as a header; that is what a recognised table
      // almost always has, and it costs nothing when it does not.
      autoTable(doc, {
        head: [payload.rows[0]!],
        body: payload.rows.slice(1),
        startY: 84,
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [27, 27, 29] }
      })
    } else {
      doc.setFontSize(10)
      doc.text(doc.splitTextToSize(payload.rows.map(row => row.join(' ')).join('\n'), 515), 40, 92)
    }

    download(doc.output('blob'), `${fileStem(payload.label, createdAt)}.pdf`)
  }

  return {
    exportXlsx,
    exportPdf,
    toXlsx: (note: NoteRecord) => exportXlsx(payloadFromNote(note)),
    toPdf: (note: NoteRecord) => exportPdf(payloadFromNote(note))
  }
}
