# @helpnest/db

Prisma ORM schema, generated client, and migrations for the entire HelpNest platform. All services that need database access import the Prisma client from this package.

This package is private and not published to npm.

## Exports

```ts
import { PrismaClient, Prisma } from '@helpnest/db'

// Named type exports
import type {
  Workspace, User, Member, Collection,
  Article, ArticleVersion, ApiKey,
  SearchIndex, ArticleFeedback, Invite,
  MemberRole, ArticleStatus, ArticleFeedbackType,
} from '@helpnest/db'
```

## Scripts

```
pnpm db:generate   # regenerate Prisma client after schema changes
pnpm db:migrate    # run pending migrations in dev
pnpm db:studio     # open Prisma Studio GUI
pnpm db:seed       # seed initial workspace and admin user
pnpm db:reset      # drop and recreate the database (destructive)
```

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

## Seed Environment Variables

| Variable | Description |
|---|---|
| `SEED_WORKSPACE_NAME` | Display name for the initial workspace |
| `SEED_WORKSPACE_SLUG` | URL slug for the initial workspace |
| `SEED_ADMIN_EMAIL` | Email address for the initial admin user |

## Dependencies

| Package | Version |
|---|---|
| `@prisma/client` | `^5.13.0` |
| `bcryptjs` | — |
| `tsx` (dev) | — |
