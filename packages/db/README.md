# @helpnest/db

Prisma ORM schema, generated client, and migrations for the entire HelpNest platform. All services that need database access import the Prisma client from this package.

This package is private and not published to npm.

## Exports

```ts
import { PrismaClient, Prisma, createPrismaClient, PrismaPg } from '@helpnest/db'

// Named type exports
import type {
  Workspace, User, Member, Collection,
  Article, ArticleVersion, ApiKey,
  SearchIndex, ArticleFeedback, Invite,
  Conversation, Message, ConversationArticle, KnowledgeGap,
} from '@helpnest/db'

// Enum exports
import {
  MemberRole, ArticleStatus, ArticleFeedbackType,
  ConversationStatus, MessageRole, AiProvider,
} from '@helpnest/db'
```

`createPrismaClient(connectionString)` — factory used by CLI tools and scripts that need their own client instance. For the Next.js app, use the singleton at `apps/web/src/lib/db.ts`.

## Scripts

Run from the **monorepo root** (`helpnest/`) unless noted:

```bash
pnpm db:generate   # regenerate Prisma client after schema changes (run from root)
pnpm db:migrate    # run pending migrations in dev (run from root)
pnpm db:studio     # open Prisma Studio GUI (run from root)
pnpm --filter @helpnest/db build     # compile src/ → dist/ (lib + seed)
pnpm --filter @helpnest/db db:seed   # seed initial workspace and admin user
pnpm --filter @helpnest/db db:reset  # drop and recreate the database (destructive)
```

For Prisma CLI commands that require the schema context (e.g. `migrate dev`, `migrate reset`), run from `packages/db/` directly:

```bash
cd packages/db
pnpm exec prisma migrate dev --name add_column
pnpm exec prisma studio
```

## Build output

`pnpm build` (via `tsup`) produces:

| File | Purpose |
|------|---------|
| `dist/index.js` | CJS build of the public `@helpnest/db` API |
| `dist/index.mjs` | ESM build of the public `@helpnest/db` API |
| `dist/seed.js` | Compiled seed script — used by `db:seed` in both local dev and production Docker |

`dist/` is gitignored. It is rebuilt on every `pnpm build` run.

## Schema

### `Workspace`

Tenant / help center. Each workspace has a unique slug.

Key fields: `slug`, `logo`, `brandText`, `customDomain`, SEO fields.

**Theme:** `themeId`, `fontPresetId`, custom CSS variable overrides for all design tokens (`cream`, `ink`, `muted`, `border`, `accent`, `green`, `white`), `borderRadius`, heading/body/brand font families with optional URL overrides.

**AI config:** `aiEnabled`, `aiProvider` (`ANTHROPIC | OPENAI | GOOGLE | MISTRAL`), `aiModel`, `aiApiKey`, `aiGreeting`, `aiInstructions`, `aiEscalationThreshold` (default `0.3`).

**Auto-draft:** `autoDraftGapsEnabled`, `autoDraftGapThreshold`, `autoDraftExternalEnabled`, `batchWindowMinutes`, `productContext`.

### `User`

Global user record, shared across workspaces.

Key fields: `email` (unique), `name`, `avatar`, `passwordHash`, `passwordChangedAt`.

### `Member`

Workspace membership record. Composite unique on `workspaceId + userId`.

Roles: `OWNER | ADMIN | EDITOR | VIEWER`. Soft-deleted via `deactivatedAt`.

### `Collection`

Article grouping. `slug` is unique per workspace.

Key fields: `isPublic` (default `true`), `isArchived`, `parentId` (for nested collections).

### `Article`

Help center content. `slug` is unique per workspace.

Key fields: `content` (full text), `draftContent` (AI suggested update), `excerpt`.

`status`: `DRAFT | PUBLISHED | ARCHIVED`. Indexed on `[workspaceId, status]`.

Counters: `views`, `helpful`, `notHelpful`.

Metadata: `isSeeded` (imported from GitHub), `aiGenerated`, `aiPrompt`.

### `ArticleVersion`

Version snapshots. Composite unique on `articleId + version`. Stores `title` and full `content` at that point in time.

### `ApiKey`

API authentication keys. `keyHash` is stored hashed (unique). `lastUsedAt` for audit.

### `SearchIndex`

One row per article. Stores the article's vector embedding as JSON in pgvector format.

### `ArticleFeedback`

Anonymous helpfulness votes. `voterToken` identifies the voter. One vote per voter per article enforced by unique constraint. Values: `HELPFUL | NOT_HELPFUL`.

### `Invite`

Team member invitations. `token` is unique. Fields: `role`, `expiresAt`, `acceptedAt`.

### `Conversation`

Customer support conversations initiated via the widget.

`sessionToken` is unique and used for widget authentication.

`status`: `ACTIVE | ESCALATED | HUMAN_ACTIVE | RESOLVED_AI | RESOLVED_HUMAN | CLOSED`.

Key fields: `customerName`, `customerEmail`, `subject`, `assignedToId`, `aiConfidence`, `escalationReason`, `resolutionSummary`.

### `Message`

Individual messages within a conversation.

`role`: `CUSTOMER | AI | AGENT | SYSTEM`. `sources` (JSON) stores referenced article IDs. Includes a `confidence` score and `feedbackHelpful` flag.

### `KnowledgeGap`

Tracks unanswered customer questions and triggers auto-draft workflows.

`queryHash` is unique per workspace. `occurrences` is incremented on each repeated query. Fields: `resolvedAt`, `resolvedById`, `resolvedArticleId`.

## Enums

`MemberRole`, `ArticleStatus`, `ArticleFeedbackType`, `ConversationStatus`, `MessageRole`, `AiProvider`

## Seed environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Required. PostgreSQL connection string |
| `ADMIN_SEED_EMAIL` | `admin@helpnest.cloud` | Email for the initial admin user |
| `ADMIN_SEED_PASSWORD` | `helpnest` | Password for the initial admin user — **must be set in production** |

## Dependencies

| Package | Version |
|---|---|
| `@prisma/client` | `^7.5.0` |
| `@prisma/adapter-pg` | `^7.5.0` |
| `pg` | `^8.11.0` |
| `bcryptjs` | — |
| `prisma` (dev) | `^7.5.0` |
| `tsup` (dev) | — |
| `tsx` (dev) | — |
