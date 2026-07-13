/**
 * gap-clustering.ts — deciding when two customer questions are the SAME gap.
 *
 * Knowledge gaps used to dedup on an exact SHA-256 of the normalised query, so
 * "how do I reset my password" and "I forgot my password" filed two separate rows
 * with one occurrence each. The auto-draft threshold (default 2 occurrences) then
 * fired far later than it looked like it would, and the backlog fragmented across
 * paraphrases of the same missing article — blunting the exact loop that is supposed
 * to turn every uncertain answer into a sharper doc.
 *
 * The obvious fix — cluster by embedding cosine — DOES NOT WORK, and it is worth
 * being precise about why, because the failure is silent and expensive. Measured on
 * text-embedding-3-small:
 *
 *   "how do I export my data"  vs "how do I import my data"    0.824   OPPOSITE
 *   "upgrade my plan"          vs "downgrade my plan"          0.792   OPPOSITE
 *   "how do I change my email" vs "how do I delete my account" 0.565   different
 *   "how do I reset my password" ~ "I forgot my password"      0.750   SAME
 *   "how do I add a teammate"    ~ "invite a colleague"        0.509   SAME
 *
 * The genuine paraphrases run from 0.51 to 0.75; the genuine non-matches run up to
 * 0.82. They overlap. There is no threshold: every cutoff that merges real
 * paraphrases also merges "upgrade" with "downgrade". Sentence embeddings encode
 * TOPIC strongly and INTENT POLARITY barely at all, and "import" and "export" are
 * the same topic.
 *
 * Merging those wrongly is worse than the fragmentation it fixes: it corrupts the
 * occurrence count AND auto-drafts a single article answering two opposite
 * questions. So the embedding is used for RECALL only — to pull a handful of
 * plausible candidates — and an LLM judge supplies PRECISION by making the actual
 * call. Cheap filter, expensive judge, exactly the tiering used elsewhere here.
 *
 * When either stage is unavailable we do NOT merge. Fragmentation is a suboptimal
 * backlog; a wrong merge is corrupt data.
 */

/**
 * Cosine floor for a gap to be considered a CANDIDATE duplicate.
 *
 * Tuned for recall, not precision — the judge rejects false positives, so the only
 * unrecoverable error here is missing a true paraphrase. Set just below the lowest
 * genuine paraphrase observed (0.509, "add a teammate" ~ "invite a colleague") with
 * headroom, because that sample is small.
 *
 * Do NOT raise this to try to make it decide on its own. It cannot — see above.
 */
export const GAP_CANDIDATE_FLOOR = 0.45

/** How many candidates to put in front of the judge. Keeps the prompt small. */
export const GAP_CANDIDATE_LIMIT = 3

/**
 * How many recent unresolved gaps to scan for candidates.
 *
 * Bounded so a workspace with a huge backlog cannot turn one gap write into an
 * unbounded read. Gaps beyond this window simply do not match semantically — they
 * still match by exact hash. Stated plainly rather than hidden: this is a
 * recall/cost tradeoff, not a guarantee of exhaustive clustering.
 */
export const GAP_SCAN_LIMIT = 200

export interface GapCandidate {
  id: string
  query: string
  embedding: number[]
}

export interface ScoredGapCandidate extends GapCandidate {
  similarity: number
}

/** Cosine similarity. Returns 0 for empty or mismatched vectors rather than NaN. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] as number
    const bi = b[i] as number
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * The plausible duplicates of `embedding`, best first.
 *
 * These are CANDIDATES, not matches. Handing any of them straight to an increment
 * without the judge is the bug this module exists to avoid.
 */
export function selectGapCandidates(
  embedding: number[],
  gaps: GapCandidate[],
  floor: number = GAP_CANDIDATE_FLOOR,
  limit: number = GAP_CANDIDATE_LIMIT
): ScoredGapCandidate[] {
  if (embedding.length === 0) return []

  return gaps
    .filter((gap) => gap.embedding.length > 0)
    .map((gap) => ({ ...gap, similarity: cosineSimilarity(embedding, gap.embedding) }))
    .filter((gap) => gap.similarity >= floor)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

/**
 * The judge's prompt. Adversarial by construction: it is told to default to NO and
 * is shown the exact failure mode it exists to prevent, because the whole point of
 * this stage is to reject the confidently-similar-but-opposite pairs that the
 * embedding cannot tell apart.
 */
export function buildGapJudgePrompt(query: string, candidates: ScoredGapCandidate[]): string {
  const numbered = candidates.map((c, i) => `${i + 1}. ${c.query}`).join('\n')

  return `A customer asked a question the help center could not answer:

NEW: ${query}

Here are questions already recorded as knowledge gaps:
${numbered}

Would ONE help article fully answer the NEW question and the existing one? Answer with the
number of that existing question, or NONE.

Be strict. Two questions about the same feature are NOT the same gap if they ask for
different actions or opposite outcomes — "how do I upgrade my plan" and "how do I downgrade
my plan" are DIFFERENT gaps and need different articles, as are importing versus exporting
data. Only answer with a number when a single article genuinely resolves both. When in
doubt, answer NONE.

Reply with only the number, or NONE.`
}

/**
 * Parses the judge's reply into the candidate it selected, or null.
 *
 * Anything unparseable is null — i.e. do not merge. A judge that produced garbage
 * has not given us permission to combine two customers' questions.
 */
export function parseGapJudgeVerdict(
  reply: string,
  candidates: ScoredGapCandidate[]
): ScoredGapCandidate | null {
  const match = reply.trim().match(/\d+/)
  if (!match) return null

  const index = Number.parseInt(match[0], 10) - 1
  return candidates[index] ?? null
}
