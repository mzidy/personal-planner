import { createHash, randomInt } from 'node:crypto'
import { and, eq, gt, sql } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

/** A link code works for ten minutes, once. */
export const LINK_CODE_TTL_MS = 10 * 60_000

function hashCode(code: string) {
  return createHash('sha256').update(`alexa-link:${code}`).digest('hex')
}

export function useAlexaRepository() {
  return {
    /** A fresh six-digit code for this user, replacing any earlier one. */
    async createLinkCode(userId: string) {
      const code = String(randomInt(100_000, 1_000_000))
      const now = new Date()
      const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS).toISOString()
      const db = useDatabase()
      await db.delete(tables.alexaLinkCodes).where(eq(tables.alexaLinkCodes.userId, userId))
      await db.insert(tables.alexaLinkCodes).values({
        id: createId('alexacode'),
        userId,
        codeHash: hashCode(code),
        expiresAt,
        createdAt: now.toISOString()
      })
      return { code, expiresAt }
    },

    /**
     * Ties an Alexa account to whoever the code belongs to, and spends the
     * code. An Alexa account speaks for one user at a time, so linking again
     * moves it.
     */
    async redeemLinkCode(code: string, alexaUserId: string) {
      const db = useDatabase()
      const now = new Date().toISOString()
      const [match] = await db
        .select()
        .from(tables.alexaLinkCodes)
        .where(and(eq(tables.alexaLinkCodes.codeHash, hashCode(code)), gt(tables.alexaLinkCodes.expiresAt, now)))
        .limit(1)
      if (!match) {
        return null
      }
      await db.delete(tables.alexaLinks).where(eq(tables.alexaLinks.alexaUserId, alexaUserId))
      await db.insert(tables.alexaLinks).values({ id: createId('alexa'), userId: match.userId, alexaUserId, createdAt: now, lastUsedAt: now })
      await db.delete(tables.alexaLinkCodes).where(eq(tables.alexaLinkCodes.id, match.id))
      return match.userId
    },

    /** The user an Alexa account speaks for, noting that it was used. */
    async findUserId(alexaUserId: string) {
      const db = useDatabase()
      const [link] = await db.select().from(tables.alexaLinks).where(eq(tables.alexaLinks.alexaUserId, alexaUserId)).limit(1)
      if (!link) {
        return null
      }
      await db.update(tables.alexaLinks).set({ lastUsedAt: new Date().toISOString() }).where(eq(tables.alexaLinks.id, link.id))
      return link.userId
    },

    async status(userId: string) {
      const [row] = await useDatabase()
        .select({ count: sql<number>`count(*)`, lastUsedAt: sql<string | null>`max(${tables.alexaLinks.lastUsedAt})` })
        .from(tables.alexaLinks)
        .where(eq(tables.alexaLinks.userId, userId))
      return { linked: Number(row?.count ?? 0), lastUsedAt: row?.lastUsedAt ?? null }
    },

    async unlinkAll(userId: string) {
      const db = useDatabase()
      await db.delete(tables.alexaLinks).where(eq(tables.alexaLinks.userId, userId))
      await db.delete(tables.alexaLinkCodes).where(eq(tables.alexaLinkCodes.userId, userId))
    }
  }
}
