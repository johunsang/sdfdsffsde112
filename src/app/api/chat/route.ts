import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { streamText } from 'ai'

export const maxDuration = 30

const providers = {
  openai: () => openai('gpt-4o'),
  anthropic: () => anthropic('claude-sonnet-4-20250514'),
  google: () => google('gemini-1.5-pro'),
}

export async function POST(req: Request) {
  const { messages, provider = 'openai' } = await req.json()

  const getModel = providers[provider as keyof typeof providers] || providers.openai

  const result = streamText({
    model: getModel(),
    messages,
  })

  return result.toDataStreamResponse()
}
