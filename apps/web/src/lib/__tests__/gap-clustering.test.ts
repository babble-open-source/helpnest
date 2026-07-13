import { describe, it, expect } from 'vitest'
import {
  GAP_CANDIDATE_FLOOR,
  buildGapJudgePrompt,
  cosineSimilarity,
  parseGapJudgeVerdict,
  selectGapCandidates,
} from '@/lib/gap-clustering'
import type { ScoredGapCandidate } from '@/lib/gap-clustering'

const vec = (...values: number[]) => values

describe('cosineSimilarity', () => {
  it('scores identical vectors as 1', () => {
    expect(cosineSimilarity(vec(1, 2, 3), vec(1, 2, 3))).toBeCloseTo(1, 6)
  })

  it('is scale-invariant', () => {
    expect(cosineSimilarity(vec(1, 2, 3), vec(2, 4, 6))).toBeCloseTo(1, 6)
  })

  it('scores orthogonal vectors as 0', () => {
    expect(cosineSimilarity(vec(1, 0), vec(0, 1))).toBe(0)
  })

  it('returns 0 rather than NaN for empty, zero, or mismatched vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0)
    expect(cosineSimilarity(vec(0, 0), vec(1, 1))).toBe(0)
    expect(cosineSimilarity(vec(1, 2), vec(1, 2, 3))).toBe(0)
  })
})

describe('selectGapCandidates', () => {
  const gap = (id: string, query: string, embedding: number[]) => ({ id, query, embedding })

  it('returns plausible duplicates, best first', () => {
    const candidates = selectGapCandidates(vec(1, 0), [
      gap('far', 'unrelated', vec(0, 1)),
      gap('near', 'paraphrase', vec(0.95, 0.05)),
      gap('mid', 'somewhat related', vec(0.7, 0.7)),
    ])

    expect(candidates.map((c) => c.id)).toEqual(['near', 'mid'])
    expect(candidates[0]!.similarity).toBeGreaterThan(candidates[1]!.similarity)
  })

  it('drops anything below the candidate floor', () => {
    const candidates = selectGapCandidates(vec(1, 0), [gap('far', 'unrelated', vec(0, 1))])
    expect(candidates).toEqual([])
  })

  it('ignores gaps filed before embeddings were available', () => {
    // Empty embedding = recorded while OPENAI_API_KEY was absent. It must not match
    // everything by scoring 0 against an arbitrary floor.
    const candidates = selectGapCandidates(vec(1, 0), [gap('legacy', 'old gap', [])])
    expect(candidates).toEqual([])
  })

  it('returns nothing when the incoming query has no embedding', () => {
    const candidates = selectGapCandidates([], [gap('near', 'paraphrase', vec(1, 0))])
    expect(candidates).toEqual([])
  })

  it('caps how many candidates reach the judge', () => {
    const gaps = Array.from({ length: 10 }, (_, i) => gap(`g${i}`, `q${i}`, vec(1, 0)))
    expect(selectGapCandidates(vec(1, 0), gaps).length).toBeLessThanOrEqual(3)
  })

  it('keeps the floor low enough to catch a real paraphrase', () => {
    // Measured on text-embedding-3-small: "how do I add a teammate" ~ "invite a
    // colleague to my workspace" scores only 0.509. A floor above that silently
    // loses genuine duplicates — which is the failure this whole tier exists to fix.
    expect(GAP_CANDIDATE_FLOOR).toBeLessThan(0.509)
  })
})

describe('buildGapJudgePrompt', () => {
  const candidates: ScoredGapCandidate[] = [
    { id: 'a', query: 'how do i downgrade my plan', embedding: [], similarity: 0.79 },
  ]

  it('warns the judge about the exact pairs cosine cannot separate', () => {
    // The embedding scores upgrade/downgrade at 0.79 and import/export at 0.82 —
    // higher than most genuine paraphrases. The judge exists solely to catch these,
    // so the prompt must name them.
    const prompt = buildGapJudgePrompt('how do i upgrade my plan', candidates)

    expect(prompt).toMatch(/upgrade/i)
    expect(prompt).toMatch(/downgrade/i)
    expect(prompt).toMatch(/different/i)
  })

  it('tells the judge to abstain when unsure', () => {
    const prompt = buildGapJudgePrompt('how do i upgrade my plan', candidates)
    expect(prompt).toMatch(/doubt.*NONE/is)
  })
})

describe('parseGapJudgeVerdict', () => {
  const candidates: ScoredGapCandidate[] = [
    { id: 'first', query: 'q1', embedding: [], similarity: 0.9 },
    { id: 'second', query: 'q2', embedding: [], similarity: 0.8 },
  ]

  it('resolves a 1-based choice to the right candidate', () => {
    expect(parseGapJudgeVerdict('2', candidates)?.id).toBe('second')
    expect(parseGapJudgeVerdict(' 1 ', candidates)?.id).toBe('first')
  })

  it('does not merge when the judge declines', () => {
    expect(parseGapJudgeVerdict('NONE', candidates)).toBeNull()
    expect(parseGapJudgeVerdict('none', candidates)).toBeNull()
  })

  it('does not merge on an out-of-range or unparseable reply', () => {
    // Silence, hallucination, or garbage is not permission to combine two
    // customers' questions. Refusing to merge is always the safe direction.
    expect(parseGapJudgeVerdict('7', candidates)).toBeNull()
    expect(parseGapJudgeVerdict('0', candidates)).toBeNull()
    expect(parseGapJudgeVerdict('', candidates)).toBeNull()
    expect(parseGapJudgeVerdict('I think maybe the first one?', candidates)).toBeNull()
  })
})
