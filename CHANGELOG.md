# Changelog

All notable changes to HelpNest will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **AI escalation gate — the agent no longer marks ungrounded answers as resolved.**

  `report_confidence` is a tool the model may simply decline to call. When it stayed
  silent, confidence fell back to a hardcoded `0.5`, which sits above the default
  escalation threshold of `0.3` — so an answer nothing supported was marked resolved
  and never reached a human. A non-numeric score fell back to the same `0.5`. Vector
  search discarded Qdrant's similarity score entirely, so "no relevant articles found"
  effectively never happened once a workspace had five articles. There was no grounding
  signal anywhere in the system.

  Retrieval is now the primary gate. How well the knowledge base matched the question
  sets a **ceiling** on confidence, and the model's self-report can only ever lower it,
  never raise it. Silence and garbage scores are recorded as `null` — "no opinion" —
  which is not the same as low confidence and never trips the threshold on its own. If
  the agent never searched (a greeting), nothing is gated and no knowledge gap is
  recorded.

### ⚠️ Behaviour change on upgrade

**Answers that previously resolved silently may now escalate.** This is the fix, not a
regression — but it will change escalation volume on existing installs, so it is called
out here rather than shipped quietly. Two escape hatches, both per-workspace:

- **Settings → AI → "Require grounded answers"** turns the retrieval gate off and
  reverts to self-report alone (the previous behaviour, minus the phantom `0.5`).
- **`aiEscalationThreshold = 0`** disables auto-escalation entirely, as it always has.

The default floors are deliberately conservative — biased toward answering rather than
escalating — so a workspace with a real knowledge base should see little change. They
are not magic numbers: run `pnpm calibrate:retrieval -- --workspace <slug>` to measure
the right floor for your own corpus. Cosine scales are **not** portable between
embedding models; the widely-quoted "0.75 means a good match" figure comes from
`ada-002` and would abstain on ~87% of good matches under `text-embedding-3-small`,
which is what HelpNest uses.

### Added

- **Grounding controls** — `aiGroundingEnabled`, `aiRetrievalFloor` and `aiLexicalFloor`
  on the workspace. The two floors are separate on purpose: the full-text fallback has no
  cosine score, so it is graded on **lexical coverage** (the fraction of the question's
  content words present in the best article) against its own floor, rather than being
  handed a fake similarity.
- **`pnpm calibrate:retrieval`** — measures a floor against your own articles and reports
  the two failure modes separately: _over-abstention_ (escalated while a good article
  existed) and _wrong-answer_ (answered from articles that did not support it). They
  trade off against each other, and a bot that escalates everything is safe and useless —
  so the script makes you choose against the cost of each rather than a single accuracy
  number.
- **Grounding breakdown persisted per message** — `retrievalMode`, `retrievalScore`,
  `reportedConfidence` and `retrievalDegraded`. A single confidence scalar cannot tell you
  afterwards _why_ a turn escalated; without these you cannot measure over-abstention in
  production or tune the floors against real traffic.
- **The inbox now shows what the AI answered from** — source articles (linked), whether the
  answer was grounded by vector or keyword search, and the model's own score separately from
  what retrieval measured. This closes a gap the escalation gate _cannot_ close by design:
  retrieval similarity measures whether an article is **about** the question, not whether it
  is **correct or current**, so a stale-but-on-topic article scores high and sails through.
  Nothing automated catches that — a human reading the source link does.
- **Semantic knowledge-gap clustering** — paraphrases of the same missing article now
  accumulate on one row instead of fragmenting across near-duplicate rows, so
  `autoDraftGapThreshold` fires when it should.

  Clustering is deliberately **not** a cosine threshold. Measured on
  `text-embedding-3-small`, `"how do I export my data"` vs `"how do I import my data"` scores
  **0.82**, and `"upgrade my plan"` vs `"downgrade my plan"` scores **0.79** — both _opposite_
  intents — while the genuine paraphrase `"add a teammate"` ~ `"invite a colleague"` scores
  only **0.51**. The distributions overlap: every threshold that merges real duplicates also
  merges upgrade with downgrade. Embeddings encode topic strongly and intent polarity barely
  at all.

  So cosine supplies **recall** (candidates) and an LLM judge supplies **precision** (the
  merge decision) — nothing merges without an explicit yes. Wrongly merging two opposite
  questions would corrupt the occurrence count _and_ auto-draft a single article answering
  both, which is worse than the fragmentation it fixes. Installs without embeddings or a
  configured model fall back to the previous exact-match behaviour.

## [0.1.0] — 2025-03-08

### Added

- **Help center** — Public-facing help center with collections and articles
- **Search** — Full-text search powered by PostgreSQL tsvector
- **AI answers** — RAG pipeline using OpenAI embeddings + Claude claude-haiku-4-5-20251001
- **Article editor** — Rich text editor (Tiptap) with auto-save and version history
- **Dashboard** — Admin UI for managing articles, collections, and settings
- **Embeddable widget** — Vanilla JS widget for embedding help launcher in any app
- **CLI** — `npx helpnest` with init, dev, export, import, and deploy commands
- **JS/TS SDK** — Typed client for the HelpNest REST API
- **Docker** — Production Dockerfile and docker-compose for self-hosting
- **Auth** — NextAuth v5 with email credentials and GitHub OAuth
