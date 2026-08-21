import type Anthropic from '@anthropic-ai/sdk'
import { learningChatSchema } from '~~/shared/schemas/learning'
import { useLearningRepository } from '~~/server/utils/learning-repository'
import { CLAUDE_MODEL, useAnthropic } from '~~/server/utils/anthropic-client'

const HISTORY_LIMIT = 40

function buildSystemPrompt(displayName: string, title: string, focus: string) {
  return [
    `You are a personal tutor inside "The Serene Executive" planner, teaching ${displayName} about: ${title}.`,
    focus ? `The learner's stated focus for this topic: ${focus}` : '',
    `Today is ${new Date().toISOString()} (UTC).`,
    'This is a persistent learning notebook — the full conversation history is saved and you build on it across sessions.',
    'Teaching style:',
    '- Explain clearly with concrete examples and analogies; prefer depth over breadth.',
    '- Connect new material to what was already covered earlier in this notebook; briefly recap when returning after a gap.',
    '- End substantial explanations with either one short comprehension question or a concrete suggestion for what to learn next — not both, and skip it for quick factual answers.',
    '- If the learner answers a quiz question, grade it honestly and correct misconceptions.',
    '- Use plain text with simple structure (short paragraphs, numbered lists, dashes). No markdown headers or tables.',
    '- Keep responses focused; a typical reply is 150-400 words unless the learner asks for more.'
  ]
    .filter(Boolean)
    .join('\n')
}

export default defineEventHandler(async event => {
  const user = await requireAppUser(event)
  await assertRateLimit(event, 'learning-chat', 20, 60_000)

  const topicId = getRouterParam(event, 'id') || ''
  const body = learningChatSchema.parse(await readBody(event))

  const repository = useLearningRepository()
  const topic = await repository.findTopic(user.id, topicId)
  if (!topic) {
    throw createError({ statusCode: 404, statusMessage: 'Topic not found.' })
  }

  const client = useAnthropic()
  const history = await repository.listMessages(user.id, topicId)

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-HISTORY_LIMIT).map(item => ({ role: item.role, content: item.content })),
    { role: 'user' as const, content: body.message }
  ]

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 3000,
    system: buildSystemPrompt(user.displayName, topic.title, topic.focus),
    messages
  })

  let reply = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim()

  if (response.stop_reason === 'refusal' || !reply) {
    reply = reply || 'I could not answer that one. Could you rephrase the question?'
  }

  const userMessage = await repository.appendMessage(user.id, topicId, 'user', body.message)
  const assistantMessage = await repository.appendMessage(user.id, topicId, 'assistant', reply)

  return { userMessage, assistantMessage }
})
