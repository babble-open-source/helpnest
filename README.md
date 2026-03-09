<div align="center">
  <h1>🪺 HelpNest</h1>
  <p><strong>The open-source customer help center. Self-host or use the cloud.</strong></p>
  <p>
    <a href="https://github.com/babble-open-source/helpnest/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
    </a>
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
    <img src="https://img.shields.io/badge/TypeScript-5.4-blue" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Next.js-14-black" alt="Next.js 14" />
  </p>
  <br />
</div>

HelpNest is a self-hostable help center and knowledge base for businesses — an open-source alternative to Intercom Articles, Zendesk Guide, and Help Scout Docs, with AI-powered search built in.

> **Not a developer docs tool.** HelpNest is built for support teams and their customers, not for engineering documentation. If you need a dev docs site, look at Mintlify or Docusaurus.

## Features

- **📚 Knowledge base** — Organize articles into collections with full CRUD from the dashboard
- **✍️ Rich text editor** — Tiptap-powered WYSIWYG with toolbar, version history, and draft/publish flow
- **🎨 Themes** — 8 built-in themes via [`@helpnest/themes`](https://www.npmjs.com/package/@helpnest/themes), applied instantly with no redeploy
- **🔍 Full-text search** — Postgres-powered search with ranked results and snippets
- **✦ AI answers** — Semantic search via OpenAI embeddings + Qdrant, answered by Claude
- **👥 Team management** — Invite members with roles: Owner, Admin, Editor, Viewer
- **🔑 API keys** — Create API keys to manage content programmatically
- **🌐 Multi-workspace** — Run multiple help centers from one instance
- **⚡ Self-hostable** — Docker Compose deployment in one command
- **🧩 Embeddable widget** — Drop a `<script>` tag into any website *(Phase 3)*
- **🔌 REST API + SDK** — JS/TS SDK published to npm as `@helpnest/sdk` *(Phase 3)*
- **🛠️ CLI** — `npx helpnest` for setup, export, import, and deployment *(Phase 3)*

## Quick Start

### Option 1 — Docker (recommended for self-hosting)

```bash
git clone https://github.com/babble-open-source/helpnest.git
cd helpnest
cp .env.example .env       # fill in AUTH_SECRET at minimum
docker compose -f docker-compose.prod.yml up -d
docker compose exec app pnpm --filter @helpnest/db db:migrate
docker compose exec app pnpm --filter @helpnest/db db:seed
```

Your help center is running at **http://localhost:3000**.

### Option 2 — Local development

```bash
git clone https://github.com/babble-open-source/helpnest.git
cd helpnest
cp .env.example .env       # fill in AUTH_SECRET at minimum
pnpm install
./scripts/dev-setup.sh     # starts Docker services, migrates DB, seeds data
pnpm dev
```

Open **http://localhost:3000** and log in with:

| | |
|---|---|
| Email | `admin@helpnest.cloud` |
| Password | `helpnest` |

The seed also creates two workspaces:
- `http://localhost:3000/helpnest/help` — HelpNest's own docs (dogfooded)
- `http://localhost:3000/support/help` — Sample cloud support center

## Environment Variables

The root `.env` is the single source of truth. `next.config.js` loads it automatically so you do **not** need a separate `apps/web/.env.local`.

```bash
cp .env.example .env
# edit .env — fill in AUTH_SECRET at minimum
```

```env
# Required
DATABASE_URL=postgresql://helpnest:helpnest@localhost:5432/helpnest_dev
AUTH_SECRET=                    # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI search (optional — falls back to full-text search without these)
OPENAI_API_KEY=                 # for article embeddings
ANTHROPIC_API_KEY=              # for AI-powered answers
QDRANT_URL=http://localhost:6333

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| Database | PostgreSQL 16 + Prisma 5 |
| Auth | NextAuth v5 (Credentials + GitHub OAuth) |
| Editor | Tiptap |
| AI | OpenAI `text-embedding-3-small` + Claude Haiku |
| Vector DB | Qdrant |
| Styling | Tailwind CSS |
| Themes | `@helpnest/themes` |
| Monorepo | Turborepo + pnpm workspaces |

## Repository Structure

```
helpnest/
├── apps/
│   ├── web/          → Help center + admin dashboard (Next.js 14, port 3000)
│   └── docs/         → HelpNest's own documentation (dogfooded, port 3001)
├── packages/
│   ├── db/           → @helpnest/db — Prisma schema + client (internal)
│   ├── ui/           → @helpnest/ui — shared React components (internal)
│   ├── config/       → @helpnest/config — shared tsconfig, ESLint, Tailwind (internal)
│   ├── editor/       → @helpnest/editor — Tiptap rich text editor
│   ├── search/       → @helpnest/search — search utilities
│   ├── widget/       → @helpnest/widget — embeddable JS snippet (Phase 3)
│   ├── sdk/          → @helpnest/sdk — JS/TS REST API SDK (Phase 3)
│   └── cli/          → @helpnest/cli — npx helpnest CLI (Phase 3)
├── scripts/
│   ├── dev-setup.sh          → first-time local setup
│   └── self-host-setup.sh    → production Docker setup
├── docker-compose.yml        → local dev services
├── docker-compose.prod.yml   → self-hosting
└── Dockerfile                → production image
```

## Common Commands

```bash
# Development
pnpm dev              # all apps: web :3000, docs :3001
pnpm build
pnpm lint
pnpm typecheck
pnpm format

# Database
pnpm db:generate      # run after schema changes before typecheck
pnpm db:migrate       # apply pending migrations
pnpm db:studio        # open Prisma Studio
pnpm --filter @helpnest/db db:seed   # seed with demo data
pnpm --filter @helpnest/db db:reset  # drop + re-migrate + re-seed

# Tests
pnpm --filter @helpnest/sdk test
```

## Themes

8 built-in themes ship with the [`@helpnest/themes`](https://github.com/babble-open-source/helpnest-themes) npm package:
**Default**, **Dark**, **Ocean**, **Forest**, **Aurora**, **Slate**, **Rose**, **Midnight**

Switch themes from **Dashboard → Settings → Appearance**. Community themes are welcome — see the [`helpnest-themes`](https://github.com/babble-open-source/helpnest-themes) repo.

## Ecosystem

| Repo | Description |
|------|-------------|
| [`helpnest`](https://github.com/babble-open-source/helpnest) | This repo — main monorepo |
| [`helpnest-themes`](https://github.com/babble-open-source/helpnest-themes) | Theme package published as `@helpnest/themes` |
| [`helpnest-intercom`](https://github.com/babble-open-source/helpnest-intercom) | Migration CLI: Intercom Articles → HelpNest |
| [`helpnest-mintlify`](https://github.com/babble-open-source/helpnest-mintlify) | Migration CLI: Mintlify docs → HelpNest |
| [`helpnest-notion`](https://github.com/babble-open-source/helpnest-notion) | Migration CLI: Notion databases → HelpNest |
| [`helpnest-slack`](https://github.com/babble-open-source/helpnest-slack) | Slack bot: `/helpnest` search + `/helpnest-ask` AI |
| [`helpnest-examples`](https://github.com/babble-open-source/helpnest-examples) | Deployment guides: Docker, Railway, Vercel, Render |
| [`helpnest-templates`](https://github.com/babble-open-source/helpnest-templates) | Industry starter content (SaaS, fintech, healthcare…) |
| [`awesome-helpnest`](https://github.com/babble-open-source/awesome-helpnest) | Community resources |
| `helpnest-cloud` *(private)* | SaaS billing, plan limits, workspace provisioning |
| `helpnest-ai-service` *(private)* | RAG pipeline, embeddings, Claude streaming |
| `helpnest-analytics` *(private)* | Event ingestion and search insights |

## Contributing

We welcome contributions. See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

MIT © HelpNest Contributors. See [LICENSE](./LICENSE).
