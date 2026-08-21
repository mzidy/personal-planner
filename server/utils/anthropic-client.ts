import Anthropic from '@anthropic-ai/sdk'

export const CLAUDE_MODEL = 'claude-opus-5'

let client: Anthropic | null = null

export function useAnthropic() {
  if (!client) {
    const config = useRuntimeConfig()
    const apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Assistant is not configured. Set NUXT_ANTHROPIC_API_KEY in .env.'
      })
    }

    client = new Anthropic({ apiKey })
  }

  return client
}
