import OpenAI from 'openai'

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined
}

export const openai =
  globalForOpenAI.openai ??
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

if (process.env.NODE_ENV !== 'production') globalForOpenAI.openai = openai

/**
 * Generate an embedding vector for a single text string.
 * Uses text-embedding-3-small (1536 dimensions, cheap and fast).
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // max input length guard
  })
  return response.data[0]?.embedding ?? []
}

/**
 * Generate embeddings for multiple texts in a single API call.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map((t) => t.slice(0, 8000)),
  })
  return response.data.map((d) => d.embedding)
}
