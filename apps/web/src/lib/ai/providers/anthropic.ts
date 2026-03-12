import Anthropic from '@anthropic-ai/sdk'
import type { ModelProvider, StreamChatParams, StreamEvent } from '../types'

export class AnthropicProvider implements ModelProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamEvent> {
    const tools = params.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    }))

    const stream = this.client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      ...(tools && tools.length > 0 ? { tools } : {}),
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          yield { type: 'text', text: chunk.delta.text }
        }
        // tool input JSON is accumulated by the SDK; we emit the completed
        // tool_use block in content_block_stop below
      } else if (chunk.type === 'content_block_stop') {
        // The SDK has fully accumulated the block at this index
        const msg = stream.currentMessage
        if (msg) {
          const block = msg.content[chunk.index]
          if (block?.type === 'tool_use') {
            yield {
              type: 'tool_call',
              name: block.name,
              args: block.input as Record<string, unknown>,
            }
          }
        }
      }
    }

    yield { type: 'done' }
  }
}
