import { QdrantClient } from '@qdrant/js-client-rest'
import { createHash } from 'node:crypto'

const globalForQdrant = globalThis as unknown as {
  qdrant: QdrantClient | undefined
}

export const qdrant =
  globalForQdrant.qdrant ??
  new QdrantClient({
    url: process.env.QDRANT_URL ?? 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  })

if (process.env.NODE_ENV !== 'production') globalForQdrant.qdrant = qdrant

export const COLLECTION_NAME = 'helpnest_articles'
export const VECTOR_SIZE = 1536 // text-embedding-3-small

/** Ensure the Qdrant collection exists */
export async function ensureCollection() {
  try {
    await qdrant.getCollection(COLLECTION_NAME)
  } catch {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
      },
    })
  }
}

/** Split text into overlapping chunks */
export function chunkText(text: string, maxTokens = 512, overlap = 50): string[] {
  // Rough approximation: 1 token ≈ 4 characters
  const chunkSize = maxTokens * 4
  const overlapSize = overlap * 4
  const chunks: string[] = []

  if (text.length <= chunkSize) {
    return [text]
  }

  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    if (end === text.length) break
    start = end - overlapSize
  }

  return chunks
}

/** Build a deterministic UUIDv4-like point ID accepted by Qdrant */
export function buildPointId(...parts: Array<string | number>): string {
  const hash = createHash('sha256').update(parts.join(':')).digest('hex')
  const version = `4${hash.slice(13, 16)}`
  const clockSeqHi = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')
  const clockSeq = `${clockSeqHi}${hash.slice(18, 20)}`
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${version}-${clockSeq}-${hash.slice(20, 32)}`
}
