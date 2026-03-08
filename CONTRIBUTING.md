# Contributing to HelpNest

Thanks for your interest in contributing! Here's how to get started.

## Local Setup

```bash
git clone https://github.com/babble-open-source/helpnest.git
cd helpnest
cp .env.example .env
pnpm install
./scripts/dev-setup.sh
pnpm dev
```

- **Web app**: http://localhost:3000
- **Docs**: http://localhost:3001
- **Prisma Studio**: `pnpm db:studio`

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/description` | `feat/article-templates` |
| Bug fix | `fix/description` | `fix/search-empty-state` |
| Docs | `docs/description` | `docs/self-hosting-guide` |
| Chore | `chore/description` | `chore/upgrade-next` |

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Make your changes and add tests where appropriate
3. Run `pnpm lint && pnpm typecheck && pnpm build` — all must pass
4. Open a PR with a clear description of the change and why
5. Link any related issues

## Code Style

- TypeScript everywhere — no `any` without a comment explaining why
- ESLint + Prettier — run `pnpm format` before committing
- Server components by default in Next.js — only use `'use client'` when needed
- Keep components small and focused

## Commit Messages

We use conventional commits:

```
feat: add article templates
fix: search modal closes on Esc
docs: update self-hosting guide
chore: upgrade Prisma to 5.14
```

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behaviour
- Environment (OS, Node version, Docker version)

## Feature Requests

Open an issue tagged `enhancement`. Describe the use case, not just the solution.

## Questions

Open a discussion on GitHub — we're happy to help.
