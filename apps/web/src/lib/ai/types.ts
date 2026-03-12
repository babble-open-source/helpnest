export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface StreamChatParams {
  system: string
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  maxTokens?: number
}

export interface ModelProvider {
  streamChat(params: StreamChatParams): AsyncIterable<StreamEvent>
}
