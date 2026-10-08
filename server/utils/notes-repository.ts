import { and, desc, eq } from 'drizzle-orm'
import type { NoteRecord, NoteSource } from '~~/shared/types/notes'
import type { NoteInput, NotePatch } from '~~/shared/schemas/notes'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

function nowIso() {
  return new Date().toISOString()
}

function hydrate(row: typeof tables.notes.$inferSelect): NoteRecord {
  return { ...row, source: row.source as NoteSource }
}

export function useNotesRepository() {
  return {
    async listNotes(userId: string): Promise<NoteRecord[]> {
      const rows = await useDatabase()
        .select()
        .from(tables.notes)
        .where(eq(tables.notes.userId, userId))
        .orderBy(desc(tables.notes.createdAt))

      return rows.map(hydrate)
    },

    async createNote(userId: string, input: NoteInput): Promise<NoteRecord> {
      const timestamp = nowIso()
      const record: NoteRecord = {
        id: createId('note'),
        userId,
        body: input.body.trim(),
        source: input.source || 'manual',
        sourceName: input.sourceName || '',
        createdAt: timestamp,
        updatedAt: timestamp
      }

      await useDatabase().insert(tables.notes).values(record)
      return record
    },

    async updateNote(userId: string, noteId: string, patch: NotePatch): Promise<NoteRecord | null> {
      const db = useDatabase()
      const [row] = await db
        .select()
        .from(tables.notes)
        .where(and(eq(tables.notes.userId, userId), eq(tables.notes.id, noteId)))
        .limit(1)

      if (!row) {
        return null
      }

      const updated: NoteRecord = {
        ...hydrate(row),
        ...(patch.body === undefined ? {} : { body: patch.body.trim() }),
        updatedAt: nowIso()
      }

      await db
        .update(tables.notes)
        .set({ body: updated.body, updatedAt: updated.updatedAt })
        .where(eq(tables.notes.id, noteId))

      return updated
    },

    async deleteNote(userId: string, noteId: string): Promise<NoteRecord | null> {
      const db = useDatabase()
      const [row] = await db
        .select()
        .from(tables.notes)
        .where(and(eq(tables.notes.userId, userId), eq(tables.notes.id, noteId)))
        .limit(1)

      if (!row) {
        return null
      }

      await db.delete(tables.notes).where(eq(tables.notes.id, noteId))
      return hydrate(row)
    }
  }
}
