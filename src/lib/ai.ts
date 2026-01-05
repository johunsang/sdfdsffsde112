import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'

export type AIProvider = 'openai' | 'anthropic' | 'google'

export const aiModels = {
  openai: {
    name: 'OpenAI',
    model: 'gpt-4o',
    getInstance: () => openai('gpt-4o'),
  },
  anthropic: {
    name: 'Anthropic',
    model: 'claude-sonnet-4-20250514',
    getInstance: () => anthropic('claude-sonnet-4-20250514'),
  },
  google: {
    name: 'Google',
    model: 'gemini-1.5-pro',
    getInstance: () => google('gemini-1.5-pro'),
  },
} as const

export function getAIModel(provider: AIProvider = 'openai') {
  return aiModels[provider].getInstance()
}
