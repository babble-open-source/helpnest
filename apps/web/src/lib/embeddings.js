import OpenAI from 'openai';
function getOpenAI() {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
/**
 * Generate an embedding vector for a single text string.
 * Uses text-embedding-3-small (1536 dimensions, cheap and fast).
 */
export async function embedText(text) {
    const response = await getOpenAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
    });
    return response.data[0]?.embedding ?? [];
}
/**
 * Generate embeddings for multiple texts in a single API call.
 */
export async function embedBatch(texts) {
    if (texts.length === 0)
        return [];
    const response = await getOpenAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: texts.map((t) => t.slice(0, 8000)),
    });
    return response.data.map((d) => d.embedding);
}
