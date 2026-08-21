import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { LearningMessageRecord, LearningTopicRecord, LearningTopicSummary } from '~~/shared/types/learning'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

function nowIso() {
  return new Date().toISOString()
}

export function useLearningRepository() {
  return {
    async listTopics(userId: string): Promise<LearningTopicSummary[]> {
      const db = useDatabase()
      const rows = await db
        .select({
          topic: tables.learningTopics,
          messageCount: sql<number>`count(${tables.learningMessages.id})`,
          lastMessageAt: sql<string | null>`max(${tables.learningMessages.createdAt})`
        })
        .from(tables.learningTopics)
        .leftJoin(tables.learningMessages, eq(tables.learningMessages.topicId, tables.learningTopics.id))
        .where(eq(tables.learningTopics.userId, userId))
        .groupBy(tables.learningTopics.id)
        .orderBy(desc(tables.learningTopics.updatedAt))

      return rows.map(row => ({
        ...(row.topic as LearningTopicRecord),
        messageCount: Number(row.messageCount ?? 0),
        lastMessageAt: row.lastMessageAt
      }))
    },

    async createTopic(userId: string, input: { title: string; focus: string }): Promise<LearningTopicRecord> {
      const record: LearningTopicRecord = {
        id: createId('topic'),
        userId,
        title: input.title,
        focus: input.focus,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await useDatabase().insert(tables.learningTopics).values(record)
      return record
    },

    async findTopic(userId: string, topicId: string): Promise<LearningTopicRecord | null> {
      const db = useDatabase()
      const [topic] = await db
        .select()
        .from(tables.learningTopics)
        .where(and(eq(tables.learningTopics.userId, userId), eq(tables.learningTopics.id, topicId)))
        .limit(1)
      return (topic as LearningTopicRecord | undefined) || null
    },

    async deleteTopic(userId: string, topicId: string) {
      const db = useDatabase()
      await db
        .delete(tables.learningMessages)
        .where(and(eq(tables.learningMessages.userId, userId), eq(tables.learningMessages.topicId, topicId)))
      await db
        .delete(tables.learningTopics)
        .where(and(eq(tables.learningTopics.userId, userId), eq(tables.learningTopics.id, topicId)))
    },

    async listMessages(userId: string, topicId: string): Promise<LearningMessageRecord[]> {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.learningMessages)
        .where(and(eq(tables.learningMessages.userId, userId), eq(tables.learningMessages.topicId, topicId)))
        .orderBy(asc(tables.learningMessages.createdAt), asc(tables.learningMessages.id))) as LearningMessageRecord[]
    },

    async appendMessage(
      userId: string,
      topicId: string,
      role: 'user' | 'assistant',
      content: string
    ): Promise<LearningMessageRecord> {
      const db = useDatabase()
      const record: LearningMessageRecord = {
        id: createId('lmsg'),
        userId,
        topicId,
        role,
        content,
        createdAt: nowIso()
      }
      await db.insert(tables.learningMessages).values(record)
      await db
        .update(tables.learningTopics)
        .set({ updatedAt: record.createdAt })
        .where(eq(tables.learningTopics.id, topicId))
      return record
    }
  }
}
