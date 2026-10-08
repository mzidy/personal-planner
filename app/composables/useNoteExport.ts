import type { NoteRecord } from '~~/shared/types/notes'

/**
 * Exports a note as a spreadsheet or a PDF.
 *
 * Both libraries are imported where they are used rather than at the top of the
 * module: together they are over a megabyte, and most visits to Notes never
 * export anything. Keeping them out of the page bundle costs one dynamic import
 * at click time.
 */

/** A safe, recognisable file stem for a note. */
function fileStem(note: NoteRecord) {
  const stamp = note.createdAt.slice(0, 16).replace(/[:T]/g, '-')
  const label = (note.sourceName || 'note').replace(/\.[^.]+$/, '')
  return `${label.replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'note'}-${stamp}`
}

/** Rows for export: the detected table, or the text split into lines. */
export function exportRows(note: NoteRecord): string[][] {
  if (note.tableRows?.length) {
    return note.tableRows
  }
  return note.body.split('\n').map(line => [line])
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

export function useNoteExport() {
  return {
    async toXlsx(note: NoteRecord) {
      const XLSX = await import('xlsx')
      const sheet = XLSX.utils.aoa_to_sheet(exportRows(note))
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, 'Note')

      const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
      download(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `${fileStem(note)}.xlsx`
      )
    },

    async toPdf(note: NoteRecord) {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const autoTable = autoTableModule.default

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const stamp = new Date(note.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      doc.setFontSize(14)
      doc.text(note.sourceName || 'Note', 40, 48)
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(stamp, 40, 64)
      doc.setTextColor(0)

      const rows = exportRows(note)

      if (note.tableRows?.length) {
        // First row is treated as a header; that is what a recognised table
        // almost always has, and it costs nothing when it does not.
        autoTable(doc, {
          head: [rows[0]!],
          body: rows.slice(1),
          startY: 84,
          styles: { fontSize: 9, cellPadding: 5 },
          headStyles: { fillColor: [27, 27, 29] }
        })
      } else {
        doc.setFontSize(10)
        doc.text(doc.splitTextToSize(note.body, 515), 40, 92)
      }

      download(doc.output('blob'), `${fileStem(note)}.pdf`)
    }
  }
}
