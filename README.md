<div align="center">
  <h1>🪺 HelpNest</h1>
  <p><strong>The open-source AI-first customer support platform.</strong></p>
  <p>
    <a href="https://github.com/babble-open-source/helpnest/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
    </a>
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
    <img src="https://img.shields.io/badge/TypeScript-5.4-blue" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js 16" />
    <a href="https://www.npmjs.com/package/@helpnest/sdk">
      <img src="https://img.shields.io/npm/v/@helpnest/sdk.svg" alt="npm" />
    </a>
  </p>
  <br />
</div>

**AI answers instantly. Your team handles what matters most.**

HelpNest is an open-source, AI-first customer support platform. It combines a knowledge base with a conversational AI agent that automatically answers customer questions — and brings in your team for the cases that need a human touch.

> **Not a traditional helpdesk.** HelpNest is built for teams that want AI to handle routine questions at scale, so your support team can focus their time on complex, high-value conversations. If you need a developer docs site, look at Mintlify or Docusaurus.

---

## How it works

```
Customer asks a question
        │
        ▼
┌─────────────────────┐
│   HelpNest Widget   │  ← embedded on your site or app
│   (conversational)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     AI Agent        │  ← searches your KB, answers with sources
│                     │  ← confidence scoring + auto-escalation
└──────────┬──────────┘
           │ Needs a human touch?
           ▼
┌─────────────────────┐
│  Escalation Inbox   │  ← your team sees the full conversation
│                     │  ← agent replies, AI provides context
└──────────┬──────────┘
           │ Recurring gaps?
           ▼
┌─────────────────────┐
│   Learning Loop     │  ← "Questions your KB can't answer yet"
│                     │  ← write one article, resolve many gaps
└─────────────────────┘
```

---

## Features

### AI Agent
- **Conversational AI** — multi-turn chat powered by your knowledge base
- **Bring your own model** — Anthropic (Claude), OpenAI (GPT), Google (Gemini), Mistral — configure from the dashboard with your own API keys
- **Confidence scoring** — AI knows when it doesn't know; auto-escalates below your threshold
- **Tool-use** — agent searches articles, asks clarifying questions, and escalates autonomously
- **Source attribution** — every AI answer cites the KB articles it used

### Knowledge Base
- **Rich text editor** — Tiptap WYSIWYG with tables, code blocks, task lists, images, version history
- **Collections** — organize articles into nested categories
- **Full-text search** — Postgres-powered with ranked results and snippets
- **Vector search** — OpenAI embeddings + Qdrant for semantic search
- **8 built-in themes** — via [`@helpnest/themes`](https://www.npmjs.com/package/@helpnest/themes)
- **Custom branding** — logo, colors, fonts, custom domain

### Escalation Inbox
- **Focused inbox** — only escalated conversations land here, not every ticket
- **Full context** — agents see the entire conversation, what the AI tried, and why it escalated
- **Assignment** — claim conversations and assign to teammates
- **Resolve flow** — resolve with an optional summary that feeds the learning loop

### Learning Loop
- **Knowledge gaps dashboard** — questions your KB can't answer, ranked by frequency
- **One-click article creation** — pre-fills the editor with the gap question as the title
- **Resolution tracking** — mark a gap resolved when you publish a covering article

### Embeddable Widget
- **Drop-in script tag** — one line of HTML, works on any site
- **Chat mode** — conversational AI, not just a search box
- **Session persistence** — customers resume conversations when they reopen the widget
- **"Talk to a human" button** — instant escalation from the widget
- **Search mode** — keyword + AI search (backwards compatible)

### Team & Admin
- **Multi-workspace** — multiple help centers from one instance
- **Roles** — Owner, Admin, Editor, Viewer
- **Invite flow** — email invites with token-based acceptance
- **API keys** — programmatic content management
- **Dashboard analytics** — AI resolution rate, escalation rate, conversations trend, knowledge gaps

---

## Quick Start

### Option 1 — Docker (recommended for self-hosting)

```bash
git clone https://github.com/babble-open-source/helpnest.git
cd helpnest
./scripts/self-host-setup.sh
```

The setup script generates secrets, configures `.env`, builds the Docker image, runs migrations, and seeds demo data. Your help center runs at **http://localhost:3000**. Login credentials are printed at the end.

### Option 2 — Local development

```bash
git clone https://github.com/babble-open-source/helpnest.git
cd helpnest
cp .env.example .env       # fill in AUTH_SECRET at minimum
pnpm install
./scripts/dev-setup.sh     # starts Docker services, migrates DB, seeds data
pnpm dev
```

Open **http://localhost:3000/login** and sign in:

| | |
|---|---|
| Email | `admin@helpnest.cloud` |
| Password | `helpnest` |

> **Never use these credentials in production.** Always set `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` before running the seed. `self-host-setup.sh` generates a strong random password automatically.

---

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://helpnest:helpnest@localhost:5432/helpnest_dev
AUTH_SECRET=                    # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Initial admin account — created once when running db:seed
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=            # minimum 12 characters in production

# AI key encryption — REQUIRED in production
# Encrypts per-workspace API keys at rest using AES-256-GCM with a unique
# random salt per key. Without this, keys are stored as plaintext.
# Generate with: openssl rand -base64 32
AI_KEY_ENCRYPTION_SECRET=

# Redis — required for distributed rate limiting (ai-search endpoint)
# Without Redis, rate limiting falls back to in-memory per-instance,
# which is ineffective in multi-instance / serverless deployments.
REDIS_URL=redis://localhost:6379

# Demo / showcase mode (optional)
HELPNEST_DEMO_MODE=             # set to "true" to show default credentials on login page

# Vector search — required for semantic search and AI agent
OPENAI_API_KEY=                 # for article embeddings
QDRANT_URL=http://localhost:6333

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

> **AI chat provider keys** (Anthropic, OpenAI, Google, Mistral) are configured per-workspace from **Dashboard → Settings → AI Agent** — not from environment variables. This lets each workspace use their own keys and preferred model.

> **Production checklist:** Set `AI_KEY_ENCRYPTION_SECRET` before any workspace saves an API key. Set `REDIS_URL` before scaling beyond a single instance. Restart the server after running Workspace schema migrations (the column cache is process-lifetime).

---

## Embedding the Widget

Add one script tag to your site:

```html
<script
  src="https://your-helpnest.com/api/widget.js"
  data-workspace="your-workspace-slug"
  async
></script>
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-workspace` | required | Your workspace slug |
| `data-mode` | `chat` | `chat` (AI conversation) or `search` (legacy) |
| `data-position` | `bottom-right` | `bottom-right` or `bottom-left` |
| `data-greeting` | workspace setting | Override the AI greeting message |

---

## SDK

```bash
npm install @helpnest/sdk
```

```typescript
import { HelpNest } from '@helpnest/sdk'

const client = new HelpNest({
  apiKey: 'hn_live_xxx',
  workspace: 'acme',
  baseUrl: 'https://your-helpnest.com',
})

// Articles & collections
await client.articles.list({ status: 'PUBLISHED' })
await client.articles.create({ title, content, collectionId })

// Conversations
await client.conversations.list({ status: 'ESCALATED' })
await client.conversations.get(id)
await client.conversations.updateStatus(id, 'RESOLVED_HUMAN', 'Issue was a billing error.')

// Messages
await client.messages.list(conversationId)
await client.messages.send(conversationId, { content: 'Here is how to fix that…' })
```

---

## AI Drafting CLI

The `helpnest` npm package bootstraps your KB by reading your codebase and auto-drafting articles.

```bash
npm install -g helpnest
```

**Draft a single article from a PR:**
```bash
helpnest draft \
  --api-key hn_live_xxx \
  --pr-title "Add dark mode toggle" \
  --pr-body "Users can now switch themes in Settings > Appearance"
```

**Seed from a local repo (no GitHub token needed):**
```bash
helpnest seed --local ./my-project --api-key hn_live_xxx
```

This uses a two-pass AI approach: first the CLI sends the repo file tree to your HelpNest instance, which uses your configured LLM to identify feature domains (conversations, auth, billing, etc.). Then it reads the actual source files for each domain and generates a KB article per feature. The code is always the source of truth — even when the README is stale.

**Seed from GitHub (README + docs + releases + PRs):**
```bash
helpnest seed \
  --repo owner/repo \
  --token ghp_xxx \
  --api-key hn_live_xxx
```

**Source options:**

| Source | GitHub mode | Local mode |
|--------|-------------|------------|
| `readme` | fetches README via GitHub API | reads README from disk |
| `docs` | fetches `.md` files under `docs/` | reads `.md` files from disk |
| `releases` | fetches GitHub Releases | not available |
| `prs` | fetches merged PRs + diffs | not available |
| `code` | not available | AI-driven feature domain discovery |
| `all` | readme + docs + releases + prs | readme + docs + code |

```bash
# Dry run — preview what would be generated, no articles created
helpnest seed --local ./my-project --dry-run

# GitHub mode, docs and releases only
helpnest seed --repo owner/repo --token ghp_xxx --source docs,releases

# Local mode, code analysis only
helpnest seed --local ./my-project --source code
```

All articles are created as `DRAFT` with `aiGenerated: true`. Review and publish from **Dashboard > AI Drafts**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router |
| Database | PostgreSQL 16 + Prisma 7 |
| Auth | NextAuth v5 (Credentials + GitHub OAuth) |
| Editor | Tiptap |
| AI (embeddings) | OpenAI `text-embedding-3-small` |
| AI (chat) | Anthropic Claude, OpenAI GPT, Google Gemini, Mistral |
| Vector DB | Qdrant |
| Cache / Rate limiting | Redis (optional, graceful fallback) |
| Styling | Tailwind CSS |
| Themes | `@helpnest/themes` |
| Monorepo | Turborepo + pnpm workspaces |

---

## Repository Structure

```
helpnest/
├── apps/
│   ├── web/          → Help center + admin dashboard (Next.js 16, port 3000)
│   └── docs/         → HelpNest's own documentation (dogfooded, port 3001)
├── packages/
│   ├── db/           → @helpnest/db — Prisma schema + client (internal)
│   ├── ui/           → @helpnest/ui — shared React components (internal)
│   ├── config/       → @helpnest/config — shared tsconfig, ESLint, Tailwind (internal)
│   ├── editor/       → @helpnest/editor — Tiptap rich text editor
│   ├── widget/       → @helpnest/widget — embeddable JS snippet
│   ├── sdk/          → @helpnest/sdk — JS/TS REST API SDK (npm: @helpnest/sdk)
│   ├── mcp/          → @helpnest/mcp — MCP server for AI assistants (npm: @helpnest/mcp)
│   ├── helpnest/     → helpnest — AI drafting CLI: draft + seed (npm: helpnest)
│   └── cli/          → @helpnest/cli — self-hosting CLI: init, dev, deploy, export, import
├── scripts/
│   ├── dev-setup.sh          → first-time local setup
│   └── self-host-setup.sh    → production Docker setup
├── docker-compose.yml        → local dev services
├── docker-compose.prod.yml   → self-hosting
└── Dockerfile                → production image
```

---

## Common Commands

```bash
# Development
pnpm dev              # all apps: web :3000, docs :3001
pnpm build            # compiles all packages (including @helpnest/db) then Next.js
pnpm lint
pnpm typecheck

# Database
pnpm db:generate      # run after schema changes before typecheck
pnpm db:migrate       # apply pending migrations
pnpm db:studio        # open Prisma Studio
pnpm --filter @helpnest/db db:seed   # seed with demo data
pnpm --filter @helpnest/db db:reset  # drop + re-migrate + re-seed

# After a Workspace migration, restart the server so the column cache refreshes:
# pnpm --filter @helpnest/web restart  (or redeploy)

# Tests
pnpm --filter @helpnest/sdk test
```

---

## AI-as-Customer: Agent Accessibility

HelpNest knowledge bases are accessible to AI agents through three complementary protocols:

### llms.txt

Every help center serves an AI-readable index at `/{workspace}/help/llms.txt` and the full article content at `/{workspace}/help/llms-full.txt`. These follow the [llms.txt specification](https://llmstxt.org) — think of it as `robots.txt` for LLMs.

```bash
curl https://help.acme.com/acme/help/llms.txt       # article index
curl https://help.acme.com/acme/help/llms-full.txt   # full content as markdown
```

### MCP Server (Model Context Protocol)

The `@helpnest/mcp` package exposes your knowledge base as tools for AI assistants like Claude Desktop, Cursor, and coding agents.

```bash
npm install -g @helpnest/mcp
```

```json
{
  "mcpServers": {
    "helpnest": {
      "command": "npx",
      "args": ["@helpnest/mcp"],
      "env": {
        "HELPNEST_API_KEY": "hn_live_xxx",
        "HELPNEST_WORKSPACE": "acme",
        "HELPNEST_BASE_URL": "https://help.acme.com"
      }
    }
  }
}
```

**Tools:** `search_articles`, `get_article`, `list_collections`, `ask_question`

### A2A (Agent-to-Agent Protocol)

HelpNest implements [Google's A2A protocol](https://github.com/google/A2A) for agent-to-agent collaboration. External agents discover capabilities via the Agent Card and interact through JSON-RPC:

```bash
# Discover the agent
curl https://help.acme.com/.well-known/agent-card.json

# Send a question (JSON-RPC 2.0)
curl -X POST https://help.acme.com/api/a2a \
  -H "Authorization: Bearer hn_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"role":"user","parts":[{"type":"text","text":"How do I reset my password?"}]}}}'
```

**Methods:** `message/send`, `message/send-streaming` (SSE), `tasks/get`, `tasks/cancel`

### Agent-Optimized API

The REST API includes endpoints designed for AI agent consumption:

```bash
# Get articles as markdown (token-efficient)
curl -H "Authorization: Bearer hn_live_xxx" \
  "https://help.acme.com/api/articles?format=markdown"

# Bulk export all published articles
curl -H "Authorization: Bearer hn_live_xxx" \
  "https://help.acme.com/api/articles/export?format=markdown"

# Change feed for incremental sync
curl -H "Authorization: Bearer hn_live_xxx" \
  "https://help.acme.com/api/articles/changes?since=2026-03-01T00:00:00Z"
```

---

## Themes

8 built-in themes ship with [`@helpnest/themes`](https://github.com/babble-open-source/helpnest-themes):
**Default**, **Dark**, **Ocean**, **Forest**, **Aurora**, **Slate**, **Rose**, **Midnight**

Switch themes from **Dashboard → Settings → Appearance**. Community themes are welcome — see the [`helpnest-themes`](https://github.com/babble-open-source/helpnest-themes) repo.

---

## Ecosystem

| Repo | Description |
|------|-------------|
| [`helpnest`](https://github.com/babble-open-source/helpnest) | This repo — main monorepo |
| [`helpnest-themes`](https://github.com/babble-open-source/helpnest-themes) | Theme package published as `@helpnest/themes` |
| [`helpnest-slack`](https://github.com/babble-open-source/helpnest-slack) | Slack bot: search + AI conversations from Slack |
| [`helpnest-intercom`](https://github.com/babble-open-source/helpnest-intercom) | Migration CLI: Intercom Articles → HelpNest |
| [`helpnest-mintlify`](https://github.com/babble-open-source/helpnest-mintlify) | Migration CLI: Mintlify docs → HelpNest |
| [`helpnest-notion`](https://github.com/babble-open-source/helpnest-notion) | Migration CLI: Notion databases → HelpNest |
| [`helpnest-examples`](https://github.com/babble-open-source/helpnest-examples) | Deployment guides: Docker, Railway, Vercel, Render |
| [`helpnest-templates`](https://github.com/babble-open-source/helpnest-templates) | Industry starter content (SaaS, fintech, healthcare…) |
| [`awesome-helpnest`](https://github.com/babble-open-source/awesome-helpnest) | Community resources |

---

## Contributing

We welcome contributions of all kinds — bug fixes, new features, themes, migration CLIs, and deployment guides. See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

MIT © HelpNest Contributors. See [LICENSE](./LICENSE).
