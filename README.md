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

HelpNest is a self-hostable help center and knowledge base for businesses. An open-source alternative to Intercom Articles, Zendesk Guide, and Help Scout Docs — with AI-powered search built in.

## Features

- **📚 Knowledge base** — Organize articles into collections, write with a rich text editor
- **🔍 Full-text search** — Fast search across all articles, built on Postgres
- **✦ AI answers** — Ask AI gets instant answers from your docs (OpenAI + Claude)
- **🧩 Embeddable widget** — Drop a `<script>` tag into any app to add a help launcher
- **⚡ Self-hostable** — One Docker command to run your own instance
- **🔌 REST API + SDK** — JS/TS SDK to manage content programmatically
- **🛠️ CLI** — `npx helpnest init` to set up, export, import, and deploy

## Quick Start

### Option 1 — Docker (recommended for self-hosting)

```bash
git clone https://github.com/babble-open-source/helpnest.git
cd helpnest
./scripts/self-host-setup.sh
```

Your help center is now running at **http://localhost:3000**.

### Option 2 — Local development

```bash
git clone https://github.com/babble-open-source/helpnest.git
cd helpnest
cp .env.example .env
pnpm install
./scripts/dev-setup.sh   # starts Docker, migrates DB, seeds data
pnpm dev
```

### Option 3 — npx

```bash
npx helpnest init
```

## Embed in your app

```html
<script
  src="https://your-helpnest-url.com/widget.js"
  data-workspace="your-workspace-slug"
  data-base-url="https://your-helpnest-url.com"
></script>
```

## JS/TS SDK

```bash
npm install @helpnest/sdk
```

```typescript
import { HelpNest } from '@helpnest/sdk'

const client = new HelpNest({
  apiKey: 'hn_live_xxx',
  workspace: 'acme',
  baseUrl: 'https://your-helpnest-url.com',
})

const articles = await client.articles.list({ status: 'PUBLISHED' })
const result = await client.articles.search('reset password')
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| Database | PostgreSQL 16 + Prisma |
| Cache | Redis 7 |
| Vector DB | Qdrant |
| Auth | NextAuth v5 |
| Editor | Tiptap |
| Styling | Tailwind CSS |
| AI | OpenAI Embeddings + Claude |
| Monorepo | Turborepo + pnpm |

## Repository Structure

```
helpnest/
├── apps/
│   ├── web/          → Help center app (Next.js)
│   └── docs/         → HelpNest documentation
├── packages/
│   ├── db/           → Prisma schema + client
│   ├── ui/           → Shared React components
│   ├── editor/       → Tiptap MDX editor
│   ├── widget/       → Embeddable JS widget
│   ├── cli/          → npx helpnest CLI
│   ├── sdk/          → JS/TS API SDK
│   └── config/       → Shared tooling config
├── docker-compose.yml         → Local dev
├── docker-compose.prod.yml    → Self-hosting
└── Dockerfile                 → Production image
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
DATABASE_URL=postgresql://helpnest:helpnest@localhost:5432/helpnest_dev
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=        # for AI search
ANTHROPIC_API_KEY=     # for AI answers
QDRANT_URL=http://localhost:6333
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

MIT © HelpNest Contributors. See [LICENSE](./LICENSE).
