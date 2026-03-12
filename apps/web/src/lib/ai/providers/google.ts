import type { ModelProvider, StreamChatParams, StreamEvent, ChatMessage } from '../types'

// @google/generative-ai is an optional dependency. The import is deferred to
// runtime so the rest of the application compiles and runs without it. If a
// workspace has selected Google as its AI provider and the package is absent,
// the user receives an actionable error message instead of a crash.

export class GoogleProvider implements ModelProvider {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<StreamEvent> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let GoogleGenerativeAI: any
    try {
      const mod = await import('@google/generative-ai')
      GoogleGenerativeAI = mod.GoogleGenerativeAI
    } catch {
      yield {
        type: 'error',
        message:
          'Google AI SDK (@google/generative-ai) is not installed. Run: pnpm add @google/generative-ai',
      }
      return
    }

    const genAI = new GoogleGenerativeAI(this.apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Google's chat API expects all messages except the last as history
    const history = params.messages.slice(0, -1).map((m: ChatMessage) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({
      history,
      systemInstruction: params.system,
    })

    const lastMessage = params.messages[params.messages.length - 1]
    if (!lastMessage) {
      yield { type: 'error', message: 'No messages provided' }
      return
    }

    const result = await chat.sendMessageStream(lastMessage.content)

    for await (const chunk of result.stream) {
      const text = chunk.text() as string
      if (text) {
        yield { type: 'text', text }
      }
    }

    yield { type: 'done' }
  }
}
