// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// User Types
export interface User {
  id: string
  email: string
  name?: string
  image?: string
  createdAt: Date
  updatedAt: Date
}

// AI Chat Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Common Types
export type WithTimestamps<T> = T & {
  createdAt: Date
  updatedAt: Date
}
