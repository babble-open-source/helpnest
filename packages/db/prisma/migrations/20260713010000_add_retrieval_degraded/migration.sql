-- Distinguish "the vector retriever isn't configured" from "the vector retriever is broken".
--
-- searchArticles caught both cases in the same bare catch block and fell through to
-- Postgres full-text either way. So a self-hosted install with no OPENAI_API_KEY (where
-- lexical search IS the intended retriever) was indistinguishable from a live Qdrant or
-- OpenAI outage — in which the primary grounding signal is dead and the escalation gate
-- is quietly running on keyword overlap alone. That could persist for weeks unnoticed.
--
-- NULL  = pre-migration rows, or the vector path was never configured.
-- false = grounding ran on its intended retriever.
-- true  = the vector retriever was configured and FAILED; this answer was graded on the
--         weaker lexical signal without anyone choosing that.
--
-- Degradation is recorded and logged, never punished: a vector-store outage must not turn
-- into an escalation storm. Lexical coverage is a weaker signal but a real one.
ALTER TABLE "Message"
  ADD COLUMN "retrievalDegraded" BOOLEAN;
