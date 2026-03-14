import OpenAI from 'openai'
import type { ModelProvider, StreamChatParams, StreamEvent } from '../types'

export class OpenAIProvider implements ModelProvider {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamEvent> {
    const tools: OpenAI.ChatCompletionTool[] | undefined = params.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: params.system },
      ...params.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const stream = await this.client.chat.completions.create({
      model: params.model ?? 'gpt-4o-mini',
      max_tokens: params.maxTokens ?? 1024,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
      stream: true,
    })

    // Tool call chunks arrive piecemeal: name in the first chunk, arguments
    // spread across subsequent chunks. Accumulate by index before emitting.
    const toolCalls = new Map<number, { name: string; args: string }>()

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue

      if (delta.content) {
        yield { type: 'text', text: delta.content }
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCalls.get(tc.index) ?? { name: '', args: '' }
          if (tc.function?.name) existing.name = tc.function.name
          if (tc.function?.arguments) existing.args += tc.function.arguments
          toolCalls.set(tc.index, existing)
        }
      }
    }

    // Emit fully-accumulated tool calls after the stream ends
    for (const [, tc] of toolCalls) {
      try {
        const args = JSON.parse(tc.args) as Record<string, unknown>
        yield { type: 'tool_call', name: tc.name, args }
      } catch {
        yield {
          type: 'error',
          message: `Failed to parse tool call arguments for "${tc.name}"`,
        }
      }
    }

    yield { type: 'done' }
  }
}
