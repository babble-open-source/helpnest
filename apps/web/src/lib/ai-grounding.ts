/**
 * ai-grounding.ts — the escalation gate's arithmetic, kept pure and free of I/O.
 *
 * The agent's confidence is derived from TWO signals with different standing:
 *
 *   1. Retrieval (primary). How well the knowledge base actually matched the
 *      question. This is measured, not asserted, and it sets the CEILING.
 *   2. The model's self-report (secondary). This can only ever LOWER the
 *      effective confidence, never raise it.
 *
 * The asymmetry is deliberate. Verbalized LLM confidence is poorly calibrated
 * and saturates near the top of the range, and a model that has already
 * committed to an answer has every incentive to justify it rather than critique
 * it. A model is worth believing when it admits doubt, not when it asserts
 * certainty — so we take the minimum of the two.
 *
 * Three states must stay distinguishable, and the old code conflated all of
 * them into the literal 0.5:
 *
 *   - "the model reported 0.5"  -> 0.5
 *   - "the model said nothing"  -> null
 *   - "the model said garbage"  -> null
 *
 * A null confidence means "no opinion", which is NOT the same as low confidence
 * and must never trip a threshold. Beware: in JavaScript `null < 0.3` coerces to
 * `0 < 0.3` and evaluates to TRUE, so never compare a nullable confidence with
 * `<` directly — always go through shouldEscalate().
 */

export type RetrievalMode = 'vector' | 'lexical' | 'none'

export interface RetrievalSignal {
  mode: RetrievalMode
  /** Cosine similarity of the best vector match. Only set when mode === 'vector'. */
  topScore: number | null
  /**
   * Fraction of the question's content lexemes present in the best article.
   * Only set when mode === 'lexical'. This is NOT a cosine similarity and is
   * deliberately graded against its own floor.
   */
  coverage: number | null
}

export interface GroundingFloors {
  retrievalFloor: number
  lexicalFloor: number
}

/**
 * Width of the ramp from "no grounding" to "fully grounded", in units of the
 * underlying score. A shape parameter, not a calibration target — the floors are
 * what you calibrate. Keeping it fixed means an operator has one number to tune
 * per retriever, not two.
 */
export const RETRIEVAL_BAND = 0.3

/**
 * Cosine floor for the vector retriever, below which a match counts as noise.
 *
 * MEASURED, not guessed. Calibrated against a 23-article corpus embedded with
 * text-embedding-3-small (see scripts/calibrate-retrieval-floor.ts):
 *
 *   - Off-domain junk ("how long should I boil an egg") topped out at 0.17.
 *     From 0.18 up, none of it passes.
 *   - Positives did not start failing until 0.50.
 *
 * So the usable band is roughly [0.18, 0.50], and we sit near its BOTTOM on
 * purpose. The positives in that run were article titles, which score higher than
 * any real customer question ever will, so the top of the band is optimistic —
 * erring high is how you get an over-abstaining bot. Erring low only lets through
 * matches that are still above every off-domain probe measured.
 *
 * This also shows why the folklore number is dangerous: a floor of 0.75 — the
 * "good match" figure everyone quotes from the ada-002 era — would have abstained
 * on 87% of even the easiest positives. Cosine scales are NOT portable between
 * embedding models. If you change the model, re-run the calibration.
 *
 * This default is a starting point for an unknown corpus, not a substitute for
 * measuring yours:
 *   pnpm calibrate:retrieval -- --workspace <slug> --queries labelled.jsonl
 * and store the result on the workspace (aiRetrievalFloor).
 */
export const DEFAULT_RETRIEVAL_FLOOR = 0.2

/**
 * Coverage floor for the Postgres full-text retriever.
 *
 * Intentionally NOT equal to DEFAULT_RETRIEVAL_FLOOR. Lexical coverage and cosine
 * similarity are different measurements on different scales; sharing a number
 * between them would be pretending they are the same signal.
 *
 * Also measured on the same corpus: 0.34 is the lowest coverage at which no
 * off-domain probe gets through (below it, up to 42% of junk does). A real
 * question's content words tend to appear in the article that answers it, so a
 * third of them matching is a low bar to clear for a genuine hit.
 */
export const DEFAULT_LEXICAL_FLOOR = 0.34

export const DEFAULT_FLOORS: GroundingFloors = {
  retrievalFloor: DEFAULT_RETRIEVAL_FLOOR,
  lexicalFloor: DEFAULT_LEXICAL_FLOOR,
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Maps a raw retriever score onto a [0, 1] confidence via a linear ramp:
 * at or below `floor` -> 0, at or above `floor + band` -> 1.
 *
 * Normalising here (rather than thresholding on the raw score) keeps
 * `aiEscalationThreshold` meaning the same thing it always has — a confidence
 * in [0, 1] — so the existing setting and its UI do not change meaning.
 */
export function scoreToConfidence(score: number, floor: number, band: number): number {
  if (band <= 0) {
    // Degenerate band — fall back to a step function rather than dividing by zero.
    return score >= floor ? 1 : 0
  }
  return clamp01((score - floor) / band)
}

/**
 * Parses the `score` argument of the model's report_confidence tool call.
 *
 * Returns null — never 0.5 — when the model did not report a usable number.
 * Silence and garbage are the absence of a signal, not a mid-range signal.
 */
export function parseReportedConfidence(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return clamp01(raw)
}

/**
 * Grades a retrieval signal against the floor appropriate to its retriever.
 *
 * A search that returned nothing scores 0: the agent looked and found no
 * grounding, which is a real (and maximally low) signal, unlike never looking.
 */
export function retrievalConfidence(signal: RetrievalSignal, floors: GroundingFloors): number {
  if (signal.mode === 'vector' && signal.topScore !== null) {
    return scoreToConfidence(signal.topScore, floors.retrievalFloor, RETRIEVAL_BAND)
  }
  if (signal.mode === 'lexical' && signal.coverage !== null) {
    return scoreToConfidence(signal.coverage, floors.lexicalFloor, RETRIEVAL_BAND)
  }
  return 0
}

export interface EffectiveConfidenceInput extends GroundingFloors {
  /** Did the agent call search_articles at all this turn? */
  searched: boolean
  /** When false, retrieval is not used as a ceiling (workspace opt-out). */
  groundingEnabled: boolean
  /** Best retrieval signal across all searches this turn. */
  signal: RetrievalSignal | null
  /** The model's self-reported score, or null if it said nothing usable. */
  reported: number | null
}

/**
 * The effective confidence for a turn, or null when we have no basis to judge.
 *
 * Null is returned when the agent never searched — a greeting or a chit-chat
 * turn was never a question against the knowledge base, so there is nothing to
 * ground and nothing to escalate. Gating those would produce a bot that
 * escalates "hi", which is safe and useless.
 */
export function effectiveConfidence(input: EffectiveConfidenceInput): number | null {
  if (!input.searched) return null

  if (!input.groundingEnabled) {
    // Retrieval ceiling disabled: fall back to the self-report alone. Note this
    // still returns null (not 0.5) on silence, so an un-grounded, un-reported
    // answer is never laundered into a passing score.
    return input.reported
  }

  const retrieval = input.signal
    ? retrievalConfidence(input.signal, {
        retrievalFloor: input.retrievalFloor,
        lexicalFloor: input.lexicalFloor,
      })
    : 0

  // The model may only lower the ceiling retrieval set, never raise it.
  return input.reported === null ? retrieval : Math.min(retrieval, input.reported)
}

/**
 * The single place a nullable confidence is compared against a threshold.
 *
 * Two invariants live here:
 *   - null never escalates (no signal is not a low signal — and a raw `null <
 *     threshold` would coerce to 0 and wrongly fire).
 *   - threshold 0 disables auto-escalation entirely. This kill switch is
 *     documented on the workspace setting and predates this module; it must
 *     keep working.
 */
export function shouldEscalate(confidence: number | null, threshold: number): boolean {
  if (confidence === null) return false
  if (threshold <= 0) return false
  return confidence < threshold
}
