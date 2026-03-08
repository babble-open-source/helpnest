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

- **📚 Knowledge base** — Organize articles into collections with full CRUD from the dashboard
- **✍️ Rich text editor** — Tiptap-powered editor with toolbar, version history, and auto-save
- **🎨 Themes** — 8 built-in themes via [`@helpnest/themes`](https://www.npmjs.com/package/@helpnest/themes), applied instantly with no redeploy
- **🔍 Full-text search** — Fast search across all articles, built on Postgres
- **✦ AI answers** — Ask AI gets instant answers from your docs (OpenAI + Claude)
- **⚡ Self-hostable** — One Docker command to run your own instance
- **🧩 Embeddable widget** — Drop a `<script>` tag into any app *(coming soon)*
- **🔌 REST API + SDK** — JS/TS SDK to manage content programmatically *(coming soon)*
- **🛠️ CLI** — `npx helpnest init` to set up, export, import, and deploy *(coming soon)*

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
cp .env.example apps/web/.env.local   # Next.js reads env from its own directory
pnpm install
./scripts/dev-setup.sh   # starts Docker, migrates DB, seeds data
pnpm dev
```

Default seed credentials: `admin@helpnest.io` / `password`

## Themes

HelpNest ships with 8 themes out of the box, powered by the [`@helpnest/themes`](https://www.npmjs.com/package/@helpnest/themes) npm package. Themes control colors, typography, and border radius across both the public help center and the admin dashboard.

```bash
npm install @helpnest/themes
```

Available themes: **Default**, **Dark**, **Ocean**, **Forest**, **Aurora**, **Slate**, **Rose**, **Midnight**

Switch themes from **Dashboard → Settings → Appearance**. Community themes are welcome — see the [`helpnest-themes`](https://github.com/babble-open-source/helpnest-themes) repo.

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
| Themes | `@helpnest/themes` |
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
│   ├── editor/       → Tiptap editor
│   ├── widget/       → Embeddable JS widget (coming soon)
│   ├── cli/          → npx helpnest CLI (coming soon)
│   ├── sdk/          → JS/TS API SDK (coming soon)
│   └── config/       → Shared tooling config
├── docker-compose.yml         → Local dev
├── docker-compose.prod.yml    → Self-hosting
└── Dockerfile                 → Production image
```

## Environment Variables

Next.js reads env files from its own directory, not the repo root — set env vars in two places:

```bash
cp .env.example .env                  # used by scripts, Prisma, Docker
cp .env.example apps/web/.env.local   # used by Next.js (gitignored)
```

Key variables:

```env
DATABASE_URL=postgresql://helpnest:helpnest@localhost:5432/helpnest_dev
AUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# AI Search (optional — required for AI-powered search)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
QDRANT_URL=http://localhost:6333
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@helpnest/themes`](https://github.com/babble-open-source/helpnest-themes) | Community theme marketplace |
| `@helpnest/widget` | Embeddable help launcher *(coming soon)* |
| `@helpnest/sdk` | JS/TS API client *(coming soon)* |
| `@helpnest/cli` | CLI for setup and content management *(coming soon)* |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

MIT © HelpNest Contributors. See [LICENSE](./LICENSE).
