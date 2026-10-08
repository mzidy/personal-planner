export type NoteSource = 'manual' | 'import'

export interface NoteRecord {
  id: string
  userId: string
  body: string
  source: NoteSource
  sourceName: string
  createdAt: string
  updatedAt: string
}

export interface NotesPayload {
  notes: NoteRecord[]
}
