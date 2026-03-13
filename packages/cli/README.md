# @helpnest/cli

Official HelpNest command-line tool. Handles workspace setup, local development, content import/export, deployment, and AI-assisted article drafting. Published to npm as `helpnest`.

## Installation

```
npm install -g helpnest
```

Or run without installing:

```
npx helpnest <command>
```

## Commands

### `helpnest init`

Interactive first-time workspace setup. Prompts for workspace name, slug, PostgreSQL URL, and admin email. Writes a `.env` file and runs Prisma migrations.

### `helpnest dev`

Starts the local development server (Next.js on `localhost:3000`). If a `docker-compose.yml` is present in the project root, Docker Compose services are started automatically.

### `helpnest export`

Exports all workspaces, collections, and published articles to a JSON file.

```
helpnest export [--output <path>]
```

| Option | Default | Description |
|---|---|---|
| `--output <path>` | `./helpnest-export.json` | Output file path |

### `helpnest import`

Imports articles from a JSON file. Supports multiple source formats.

```
helpnest import --file <path> [--format <format>]
```

| Option | Default | Description |
|---|---|---|
| `--file <path>` | — | Path to the import file (required) |
| `--format <format>` | `helpnest` | Source format: `helpnest`, `intercom`, `zendesk` |

### `helpnest deploy`

Deploys to a hosting provider.

```
helpnest deploy [--target <target>]
```

| Option | Default | Description |
|---|---|---|
| `--target <target>` | `docker` | Deployment target: `docker`, `vercel`, `railway` |

### `helpnest draft`

Auto-drafts a knowledge base article from a pull request description using AI.

```
helpnest draft --pr-title <title> [options]
```

| Option | Default | Description |
|---|---|---|
| `--pr-title <title>` | — | PR title (required) |
| `--pr-body <body>` | — | PR description |
| `--diff <diff>` | — | Code diff (opt-in context for the AI) |
| `--collection <id>` | — | Target collection ID |
| `--feature-id <id>` | — | Shared feature ID for multi-repo batching |
| `--api-key <key>` | `HELPNEST_API_KEY` env | HelpNest API key |
| `--workspace <slug>` | `HELPNEST_WORKSPACE` env | Workspace slug |
| `--base-url <url>` | `https://helpnest.cloud` | HelpNest base URL |

### `helpnest seed`

Bootstraps knowledge base articles by fetching merged pull requests from a GitHub repository and generating article drafts for each.

```
helpnest seed --repo <owner/repo> [options]
```

| Option | Default | Description |
|---|---|---|
| `--repo <owner/repo>` | — | GitHub repository (required) |
| `--token <token>` | `GITHUB_TOKEN` env | GitHub personal access token |
| `--limit <n>` | `50` | Maximum number of PRs to process |
| `--from <date>` | — | Only PRs merged after this ISO 8601 date |
| `--delay <ms>` | `200` | Delay between GitHub API calls |
| `--collection <id>` | — | Target collection ID |
| `--dry-run` | — | Preview results without generating articles |
| `--api-key <key>` | `HELPNEST_API_KEY` env | HelpNest API key |
| `--workspace <slug>` | `HELPNEST_WORKSPACE` env | Workspace slug |
| `--base-url <url>` | `https://helpnest.cloud` | HelpNest base URL |

Low-signal PRs are filtered automatically (chore, ci, dependency updates, version bumps, and semver-only titles). The command is idempotent: re-running against the same repository produces no duplicates. Idempotency is enforced via SHA256 keys derived from PR content.

## Environment Variables

| Variable | Used by |
|---|---|
| `HELPNEST_API_KEY` | `draft`, `seed` |
| `HELPNEST_WORKSPACE` | `draft`, `seed` |
| `GITHUB_TOKEN` | `seed` |

## Dependencies

`commander`, `inquirer`, `ora`, `chalk`, `execa`, `@prisma/client`
