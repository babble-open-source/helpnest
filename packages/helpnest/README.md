# helpnest

Official CLI for [HelpNest](https://helpnest.cloud) — auto-draft knowledge base articles from pull requests and GitHub repository history using AI.

## Installation

```bash
npm install -g helpnest
```

Or run without installing:

```bash
npx helpnest <command>
```

## Commands

### `helpnest draft`

Auto-draft a KB article from a single PR or a plain text topic.

```bash
helpnest draft --pr-title <title> [options]
helpnest draft --topic <topic> [options]
```

| Option | Default | Description |
|---|---|---|
| `--pr-title <title>` | — | PR or change title (required if `--topic` not set) |
| `--topic <topic>` | — | Plain text topic or question to draft an article about |
| `--pr-body <body>` | — | PR description |
| `--diff <diff>` | — | Code diff (optional context for the AI) |
| `--collection <id>` | — | Target collection ID |
| `--feature-id <id>` | — | Shared feature ID for multi-repo batching |
| `--local <path>` | — | Local repo path to scan for code context (used with --topic) |
| `--rounds <n>` | `3` | Max refinement rounds for code context scanning (used with --local) |
| `--api-key <key>` | `HELPNEST_API_KEY` env | HelpNest API key |
| `--base-url <url>` | `https://helpnest.cloud` | HelpNest instance URL (use `http://localhost:3000` for local dev) |

**Examples:**

```bash
# Draft from a PR
helpnest draft \
  --pr-title "Add webhook retry with exponential backoff" \
  --pr-body "Webhooks now retry up to 5 times on failure..." \
  --collection clx123abc

# Draft from a plain topic
helpnest draft --topic "How to reset your password"
helpnest draft --topic "Setting up SSO" --collection clx123

# Draft from a topic, grounded in your codebase (local dev)
helpnest draft --topic "How SSO works" --local ./my-app --base-url http://localhost:3000
```

**`--local` and code context:** When `--topic` is paired with `--local <path>`, the CLI scans your codebase and uses AI (via your HelpNest API key) to identify which files are relevant to the topic, then sends their contents as grounding context for article generation. In git repos, scanning uses `git ls-files` so `.gitignore` is respected automatically and all languages are supported. Falls back to a filesystem walk for non-git directories. Requires `--api-key` (or `HELPNEST_API_KEY`).

**Multi-repo batching:** Pass `--feature-id` to group PRs from multiple repositories into a single article. The first call queues the context; subsequent calls accumulate; the article is generated when the batch is flushed.

---

### `helpnest seed`

Bootstrap your knowledge base from an entire repository — README sections, docs files, GitHub releases, merged PRs, or local source code. All sources are idempotent: re-running against the same repository produces no duplicates.

```bash
helpnest seed [options]
```

| Option | Default | Description |
|---|---|---|
| `--repo <owner/repo>` | — | GitHub repository (required for GitHub mode) |
| `--local <path>` | — | Local repo path (enables local mode, no token needed) |
| `--topics <topics>` | — | Comma-separated list of topics to draft articles for directly |
| `--rounds <n>` | `3` | Max refinement rounds for code context scanning (used with --local) |
| `--token <token>` | `GITHUB_TOKEN` env | GitHub personal access token |
| `--source <sources>` | `all` | Comma-separated: `readme`, `docs`, `releases`, `prs`, `code` |
| `--limit <n>` | `50` | Max items per source to process |
| `--from <date>` | — | Only PRs/releases after this ISO 8601 date |
| `--delay <ms>` | `200` | Delay between API calls (ms) |
| `--collection <id>` | — | Target collection ID |
| `--dry-run` | — | Preview items without generating articles |
| `--api-key <key>` | `HELPNEST_API_KEY` env | HelpNest API key |
| `--base-url <url>` | `https://helpnest.cloud` | HelpNest instance URL (use `http://localhost:3000` for local dev) |

**Sources** (`--source` values, default: `all`):

| Source | `--repo` | `--local` | Notes |
|---|---|---|---|
| `readme` | ✓ | ✓ | H2 sections from README |
| `docs` | ✓ | ✓ | `.md`/`.mdx` files in `docs/` |
| `releases` | ✓ | — | GitHub releases with release notes |
| `prs` | ✓ | — | Merged PRs (skips chore/ci/deps) |
| `code` | — | ✓ | AI identifies feature domains from `git ls-files` tree |

`--topics` is independent of `--source` and can be combined with `--local` (grounds each topic in matching source files) or used alone (generic, no code context).

**Examples:**

```bash
# Seed from a public GitHub repo
helpnest seed --repo acme/my-app --token ghp_xxx

# Seed only from releases and docs
helpnest seed --repo acme/my-app --source releases,docs --token ghp_xxx

# Seed from a local repo (no GitHub token needed)
helpnest seed --local ./my-app

# Seed topics grounded in your codebase (local dev)
helpnest seed --topics "SSO, billing, password reset" --local ./my-app --base-url http://localhost:3000

# Seed topics without code context (generic)
helpnest seed --topics "SSO, billing, password reset"
helpnest seed --topics "SSO, billing" --collection clx123 --api-key hn_xxx

# Preview without generating anything
helpnest seed --repo acme/my-app --dry-run --token ghp_xxx

# Only process content merged after a specific date
helpnest seed --repo acme/my-app --from 2025-01-01 --token ghp_xxx
```

## Environment Variables

| Variable | Used by |
|---|---|
| `HELPNEST_API_KEY` | `draft`, `seed` |
| `GITHUB_TOKEN` | `seed` (GitHub mode) |

## Self-hosted

If you're running HelpNest on your own infrastructure, point the CLI at your instance:

```bash
helpnest seed --repo acme/my-app --base-url https://help.acme.com --api-key hn_xxx
```

## License

MIT
