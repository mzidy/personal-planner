export interface LearningTopicRecord {
  id: string
  userId: string
  title: string
  focus: string
  createdAt: string
  updatedAt: string
}

export interface LearningMessageRecord {
  id: string
  userId: string
  topicId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface LearningTopicSummary extends LearningTopicRecord {
  messageCount: number
  lastMessageAt: string | null
}
