import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LEXICAL_FLOOR,
  DEFAULT_RETRIEVAL_FLOOR,
  RETRIEVAL_BAND,
  effectiveConfidence,
  parseReportedConfidence,
  retrievalConfidence,
  scoreToConfidence,
  shouldEscalate,
} from '@/lib/ai-grounding'

describe('scoreToConfidence', () => {
  it('maps a score at or below the floor to zero confidence', () => {
    expect(scoreToConfidence(0.25, 0.25, 0.3)).toBe(0)
    expect(scoreToConfidence(0.05, 0.25, 0.3)).toBe(0)
    expect(scoreToConfidence(-0.4, 0.25, 0.3)).toBe(0)
  })

  it('maps a score at or above floor+band to full confidence', () => {
    expect(scoreToConfidence(0.55, 0.25, 0.3)).toBe(1)
    expect(scoreToConfidence(0.9, 0.25, 0.3)).toBe(1)
  })

  it('ramps linearly between the floor and floor+band', () => {
    expect(scoreToConfidence(0.4, 0.25, 0.3)).toBeCloseTo(0.5, 5)
    expect(scoreToConfidence(0.325, 0.25, 0.3)).toBeCloseTo(0.25, 5)
  })

  it('degrades to a step function when the band is zero or negative', () => {
    expect(scoreToConfidence(0.25, 0.25, 0)).toBe(1)
    expect(scoreToConfidence(0.24, 0.25, 0)).toBe(0)
  })
})

describe('parseReportedConfidence', () => {
  it('returns null when the model said nothing — silence is not a score', () => {
    expect(parseReportedConfidence(undefined)).toBeNull()
    expect(parseReportedConfidence(null)).toBeNull()
  })

  it('returns null for a non-numeric score rather than defaulting to 0.5', () => {
    expect(parseReportedConfidence('high')).toBeNull()
    expect(parseReportedConfidence('0.9')).toBeNull()
    expect(parseReportedConfidence({ score: 0.9 })).toBeNull()
    expect(parseReportedConfidence(true)).toBeNull()
  })

  it('returns null for NaN and non-finite numbers', () => {
    expect(parseReportedConfidence(NaN)).toBeNull()
    expect(parseReportedConfidence(Infinity)).toBeNull()
    expect(parseReportedConfidence(-Infinity)).toBeNull()
  })

  it('clamps a valid numeric score into [0, 1]', () => {
    expect(parseReportedConfidence(0.7)).toBe(0.7)
    expect(parseReportedConfidence(1.8)).toBe(1)
    expect(parseReportedConfidence(-3)).toBe(0)
    expect(parseReportedConfidence(0)).toBe(0)
  })
})

describe('retrievalConfidence', () => {
  const floors = { retrievalFloor: 0.25, lexicalFloor: 0.34 }

  it('scores a search that returned nothing as zero grounding', () => {
    expect(retrievalConfidence({ mode: 'none', topScore: null, coverage: null }, floors)).toBe(0)
  })

  it('scores the vector path off the cosine similarity', () => {
    expect(retrievalConfidence({ mode: 'vector', topScore: 0.55, coverage: null }, floors)).toBe(1)
    expect(retrievalConfidence({ mode: 'vector', topScore: 0.08, coverage: null }, floors)).toBe(0)
  })

  it('scores the lexical path off coverage, against its own floor', () => {
    // Coverage 0.34 sits exactly on the lexical floor -> no grounding.
    expect(retrievalConfidence({ mode: 'lexical', topScore: null, coverage: 0.34 }, floors)).toBe(0)
    expect(retrievalConfidence({ mode: 'lexical', topScore: null, coverage: 1 }, floors)).toBe(1)
  })

  it('does not grade lexical coverage against the cosine floor', () => {
    // 0.3 coverage clears the 0.25 cosine floor but not the 0.34 lexical floor.
    // If the two floors were conflated this would return a non-zero value.
    expect(retrievalConfidence({ mode: 'lexical', topScore: null, coverage: 0.3 }, floors)).toBe(0)
  })
})

describe('effectiveConfidence', () => {
  const base = {
    searched: true,
    groundingEnabled: true,
    retrievalFloor: DEFAULT_RETRIEVAL_FLOOR,
    lexicalFloor: DEFAULT_LEXICAL_FLOOR,
  }

  it('returns null when the agent never searched — there was no question to ground', () => {
    expect(
      effectiveConfidence({
        ...base,
        searched: false,
        signal: null,
        reported: null,
      })
    ).toBeNull()
  })

  it('returns null when the agent never searched even if it volunteered a score', () => {
    expect(
      effectiveConfidence({
        ...base,
        searched: false,
        signal: null,
        reported: 0.95,
      })
    ).toBeNull()
  })

  it('falls back to retrieval alone when the model stays silent', () => {
    const strong = effectiveConfidence({
      ...base,
      signal: { mode: 'vector', topScore: 0.6, coverage: null },
      reported: null,
    })
    expect(strong).toBe(1)

    const weak = effectiveConfidence({
      ...base,
      signal: { mode: 'vector', topScore: 0.08, coverage: null },
      reported: null,
    })
    expect(weak).toBe(0)
  })

  it('lets the model lower confidence below what retrieval suggests', () => {
    const value = effectiveConfidence({
      ...base,
      signal: { mode: 'vector', topScore: 0.6, coverage: null },
      reported: 0.2,
    })
    expect(value).toBe(0.2)
  })

  it('never lets the model raise confidence above what retrieval supports', () => {
    const value = effectiveConfidence({
      ...base,
      signal: { mode: 'vector', topScore: 0.08, coverage: null },
      reported: 0.95,
    })
    expect(value).toBe(0)
  })

  it('ignores the retrieval ceiling when grounding is disabled for the workspace', () => {
    const value = effectiveConfidence({
      ...base,
      groundingEnabled: false,
      signal: { mode: 'vector', topScore: 0.08, coverage: null },
      reported: 0.95,
    })
    expect(value).toBe(0.95)
  })

  it('returns null with grounding disabled and a silent model — never 0.5', () => {
    const value = effectiveConfidence({
      ...base,
      groundingEnabled: false,
      signal: { mode: 'vector', topScore: 0.08, coverage: null },
      reported: null,
    })
    expect(value).toBeNull()
  })
})

describe('shouldEscalate', () => {
  it('escalates when effective confidence is below the threshold', () => {
    expect(shouldEscalate(0.1, 0.3)).toBe(true)
  })

  it('does not escalate at or above the threshold', () => {
    expect(shouldEscalate(0.3, 0.3)).toBe(false)
    expect(shouldEscalate(0.9, 0.3)).toBe(false)
  })

  it('never escalates on a null confidence — no signal is not a low signal', () => {
    expect(shouldEscalate(null, 0.3)).toBe(false)
  })

  it('preserves the documented kill switch: threshold 0 disables auto-escalation', () => {
    expect(shouldEscalate(0, 0)).toBe(false)
    expect(shouldEscalate(0.0001, 0)).toBe(false)
  })
})

describe('defaults', () => {
  it('keeps the lexical floor independent of the cosine floor', () => {
    expect(DEFAULT_LEXICAL_FLOOR).not.toBe(DEFAULT_RETRIEVAL_FLOOR)
  })

  it('exposes a positive band so the ramp is not a step function by default', () => {
    expect(RETRIEVAL_BAND).toBeGreaterThan(0)
  })
})
