-- Grounding gate for the AI agent's escalation decision.
--
-- Before this change the agent's confidence defaulted to 0.5 whenever the model
-- declined to call the optional report_confidence tool. 0.5 sits above the default
-- escalation threshold of 0.3, so an answer the model never vouched for — and that
-- retrieval never supported — was marked resolved and never escalated.
--
-- Retrieval now sets a ceiling on confidence and the model's self-report can only
-- lower it. See apps/web/src/lib/ai-grounding.ts.
--
-- BEHAVIOUR CHANGE ON UPGRADE. aiGroundingEnabled defaults to TRUE, including for
-- existing workspaces, so ungrounded answers that previously resolved silently will
-- now escalate. This is intentional: the previous behaviour was the bug. Two escape
-- hatches exist for operators who need the old behaviour back:
--
--   UPDATE "Workspace" SET "aiGroundingEnabled" = false;   -- self-report only (legacy)
--   UPDATE "Workspace" SET "aiEscalationThreshold" = 0;    -- disable auto-escalation entirely
--
-- Both floors are left NULL, which means "use the conservative built-in default".
-- The defaults are deliberately biased toward under-escalating so the upgrade does
-- not flood inboxes; calibrate them against your own corpus with
--   pnpm calibrate:retrieval -- --workspace <slug>
-- and store the result per workspace.

ALTER TABLE "Workspace"
  ADD COLUMN "aiGroundingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "aiRetrievalFloor"   DOUBLE PRECISION,
  ADD COLUMN "aiLexicalFloor"     DOUBLE PRECISION;

-- The grounding breakdown behind each answer's confidence score.
--
-- Persisted from day one because a single scalar cannot tell you, after the fact,
-- WHICH failure mode you are looking at. The two trade off against each other and
-- have to be measured separately:
--
--   wrong-answer rate   — grounded faithfully, but to a stale or contradictory
--                         article. Retrieval scored high; the answer was still wrong.
--   over-abstention rate — escalated to a human while a perfectly good article
--                         existed. Retrieval scored low when it should not have.
--
-- Tuning the floors against the cost of each requires these columns. A bot that
-- escalates everything is safe and useless; without this data you cannot tell how
-- close you are to that.
ALTER TABLE "Message"
  ADD COLUMN "retrievalMode"      TEXT,
  ADD COLUMN "retrievalScore"     DOUBLE PRECISION,
  ADD COLUMN "reportedConfidence" DOUBLE PRECISION;
