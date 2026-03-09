import { PrismaClient, ArticleStatus, MemberRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create user
  const user = await prisma.user.upsert({
    where: { email: 'admin@helpnest.io' },
    update: {},
    create: {
      email: 'admin@helpnest.io',
      name: 'HelpNest Admin',
      avatar: null,
    },
  })

  // HelpNest docs workspace — dogfooding: HelpNest documents itself
  const docsWorkspace = await prisma.workspace.upsert({
    where: { slug: 'helpnest' },
    update: {},
    create: {
      name: 'HelpNest',
      slug: 'helpnest',
      logo: null,
      themeId: 'default',
    },
  })

  await prisma.member.upsert({
    where: { workspaceId_userId: { workspaceId: docsWorkspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: docsWorkspace.id, userId: user.id, role: MemberRole.OWNER },
  })

  // Collections
  const colGettingStarted = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'getting-started' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'Getting Started', description: 'Install and run HelpNest in minutes.', emoji: '🚀', slug: 'getting-started', order: 0, isPublic: true },
  })

  const colSelfHosting = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'self-hosting' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'Self-Hosting', description: 'Run HelpNest on your own infrastructure.', emoji: '🖥️', slug: 'self-hosting', order: 1, isPublic: true },
  })

  const colDashboard = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'using-helpnest' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'Using HelpNest', description: 'Managing your help center — articles, collections, themes.', emoji: '✏️', slug: 'using-helpnest', order: 2, isPublic: true },
  })

  const colIntegrations = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'integrations' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'Integrations', description: 'Widget, API, SDK and third-party integrations.', emoji: '🔌', slug: 'integrations', order: 3, isPublic: true },
  })

  const docsArticles = [
    // Getting Started
    {
      collectionId: colGettingStarted.id,
      title: 'What is HelpNest?',
      slug: 'what-is-helpnest',
      excerpt: 'HelpNest is an open-source help center for customer-facing support teams.',
      order: 0,
      content: `# What is HelpNest?

HelpNest is an open-source, self-hostable help center platform. It gives your customers a clean, searchable knowledge base — and your support team a simple dashboard to manage it.

## Who is it for?

HelpNest is built for support teams, small businesses, and SaaS companies that need to publish help articles for their customers. It is not a developer documentation tool.

## Key features

- **Rich article editor** — Tiptap-powered WYSIWYG editor with version history
- **AI-powered search** — semantic search using OpenAI embeddings and Qdrant
- **Themes** — swap your help center's look with community-built themes
- **Multi-workspace** — run multiple help centers from one instance
- **Self-hostable** — MIT licensed, deploy on any server

## How does it compare?

HelpNest is a direct alternative to Intercom Articles, Zendesk Guide, Freshdesk Knowledge Base, and Help Scout Docs — with no per-seat pricing and full data ownership.`,
    },
    {
      collectionId: colGettingStarted.id,
      title: 'Quick Start (Local Development)',
      slug: 'quick-start',
      excerpt: 'Run HelpNest locally in under 5 minutes.',
      order: 1,
      content: `# Quick Start (Local Development)

Get HelpNest running on your machine in a few minutes.

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (for PostgreSQL, Redis, Qdrant)

## Steps

1. Clone the repository

\`\`\`
git clone https://github.com/babble-open-source/helpnest
cd helpnest
\`\`\`

2. Copy the environment file and fill in the values

\`\`\`
cp .env.example .env
\`\`\`

3. Start the services and seed the database

\`\`\`
./scripts/dev-setup.sh
\`\`\`

4. Install dependencies and start the dev server

\`\`\`
pnpm install
pnpm dev
\`\`\`

5. Open http://localhost:3000 and log in with admin@helpnest.io.

## What the seed creates

The setup script seeds two workspaces:

- **Acme Corp** at /acme/help — a sample customer help center
- **HelpNest** at /helpnest/help — the docs you are reading right now`,
    },
    {
      collectionId: colGettingStarted.id,
      title: 'Environment Variables',
      slug: 'environment-variables',
      excerpt: 'All environment variables HelpNest needs to run.',
      order: 2,
      content: `# Environment Variables

Copy .env.example to .env and fill in the values below.

## Required

- **DATABASE_URL** — PostgreSQL connection string
- **AUTH_SECRET** — Random secret for NextAuth. Run: openssl rand -base64 32
- **NEXTAUTH_URL** — Public URL of the app (e.g. http://localhost:3000)

## Optional — AI Search

- **OPENAI_API_KEY** — Required for generating article embeddings
- **QDRANT_URL** — Qdrant vector DB URL (default: http://localhost:6333)
- **QDRANT_API_KEY** — Only needed if Qdrant has authentication enabled

## Optional — OAuth

- **GITHUB_CLIENT_ID** — GitHub OAuth app client ID
- **GITHUB_CLIENT_SECRET** — GitHub OAuth app client secret

## Optional — Storage

Image uploads require S3-compatible storage.

- **S3_BUCKET** — S3 bucket name
- **S3_REGION** — e.g. us-east-1
- **S3_ACCESS_KEY** — AWS access key ID
- **S3_SECRET_KEY** — AWS secret access key`,
    },

    // Self-Hosting
    {
      collectionId: colSelfHosting.id,
      title: 'Docker Compose Deployment',
      slug: 'docker-compose',
      excerpt: 'The easiest way to self-host HelpNest using Docker Compose.',
      order: 0,
      content: `# Docker Compose Deployment

The easiest way to run HelpNest in production is with Docker Compose.

## What is included

The provided docker-compose.yml runs:

- **HelpNest** — the Next.js app (port 3000)
- **PostgreSQL 16** — primary database
- **Redis 7** — caching and sessions
- **Qdrant** — vector database for AI search

## Steps

1. Clone the repo on your server

\`\`\`
git clone https://github.com/babble-open-source/helpnest
cd helpnest
\`\`\`

2. Create your .env file

\`\`\`
cp .env.example .env
\`\`\`

3. Start everything

\`\`\`
docker compose up -d
\`\`\`

4. Run migrations and seed

\`\`\`
docker compose exec app pnpm --filter @helpnest/db db:migrate
docker compose exec app pnpm --filter @helpnest/db db:seed
\`\`\`

5. Visit your server on port 3000.

## Updating

\`\`\`
git pull
docker compose build app
docker compose up -d
\`\`\``,
    },
    {
      collectionId: colSelfHosting.id,
      title: 'Custom Domain Setup',
      slug: 'custom-domain',
      excerpt: 'Point a custom domain at your HelpNest help center.',
      order: 1,
      content: `# Custom Domain Setup

You can serve your help center on a custom domain like help.yourcompany.com.

## Option 1 — Subdomain (recommended)

1. Add a CNAME record pointing help.yourcompany.com to your server's IP address.
2. In your HelpNest dashboard, go to Settings and enter help.yourcompany.com in the Custom Domain field.
3. Set up a reverse proxy to forward requests to the HelpNest app.

### nginx example

\`\`\`
server {
  server_name help.yourcompany.com;
  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
\`\`\`

## Option 2 — Path prefix

If you want yourcompany.com/help, proxy all /help requests to the HelpNest app.

## SSL

Use Certbot with Let's Encrypt for free SSL certificates, or use Caddy which handles SSL automatically.`,
    },

    // Using HelpNest
    {
      collectionId: colDashboard.id,
      title: 'Managing Collections',
      slug: 'managing-collections',
      excerpt: 'Collections group related articles together in your help center.',
      order: 0,
      content: `# Managing Collections

Collections are the top-level groupings in your help center. Every article belongs to a collection.

## Creating a collection

1. Go to Dashboard > Collections
2. Click New Collection
3. Choose an emoji, give it a title and optional description
4. Click Create

## Editing a collection

Click the actions menu next to any collection and select Edit.

## Deleting a collection

Collections can only be deleted when they have no articles. Move or delete all articles first, then delete the collection.`,
    },
    {
      collectionId: colDashboard.id,
      title: 'Writing and Publishing Articles',
      slug: 'writing-articles',
      excerpt: 'Create and publish help articles using the rich text editor.',
      order: 1,
      content: `# Writing and Publishing Articles

HelpNest includes a full-featured rich text editor powered by Tiptap.

## Creating an article

1. Go to Dashboard > Articles
2. Click New Article
3. Choose a collection and enter a title

## The editor

The toolbar supports bold, italic, strikethrough, inline code, headings (H1–H3), bullet and numbered lists, blockquote, code blocks, links, and images.

## Panels

- **Outline panel** (left) — shows all headings, click to jump to any section
- **Properties panel** (right) — collection, URL slug, excerpt, and status

## Saving

Changes auto-save every 30 seconds. Click Save draft to save immediately.

## Publishing

Click Publish to make the article live on your help center. Click Update to save changes to an already-published article.

## Version history

Click History to view and restore previous saved versions.`,
    },
    {
      collectionId: colDashboard.id,
      title: 'Customising Your Theme',
      slug: 'themes',
      excerpt: 'Change the look of your help center with community-built themes.',
      order: 2,
      content: `# Customising Your Theme

HelpNest ships with 8 built-in themes from the @helpnest/themes package.

## Changing the theme

1. Go to Dashboard > Settings
2. Browse the theme gallery under Help Center Theme
3. Click a theme to select it
4. Click Apply theme

The theme is applied instantly — no redeploy needed.

## Available themes

- **Default** — Warm cream with Instrument Serif
- **Dark** — Inverted warm tones
- **Ocean** — Clean blues, corporate feel
- **Forest** — Deep earthy greens with Lora
- **Aurora** — Violet with Syne
- **Slate** — Neutral grays, enterprise
- **Rose** — Soft pinks with Playfair Display
- **Midnight** — Deep navy, developer-focused

## Community themes

Additional themes are available from the @helpnest/themes npm package. See the helpnest-themes repository for contribution guidelines.`,
    },

    // Integrations
    {
      collectionId: colIntegrations.id,
      title: 'Embeddable Widget',
      slug: 'widget',
      excerpt: 'Embed a help widget on any website with a single script tag.',
      order: 0,
      content: `# Embeddable Widget

The HelpNest widget lets your customers search your help center from any page on your site.

## Installation

Add the following snippet before the closing body tag on your website:

\`\`\`
<script>
  window.HelpNest = { workspace: 'your-workspace-slug' };
</script>
<script src="https://cdn.helpnest.io/widget.js" async></script>
\`\`\`

Replace your-workspace-slug with your workspace slug from Settings.

## Self-hosted

Point the script src at your own instance:

\`\`\`
<script src="https://your-domain.com/widget.js" async></script>
\`\`\`

> The widget package is currently in development (Phase 3 of the roadmap).`,
    },
    {
      collectionId: colIntegrations.id,
      title: 'REST API',
      slug: 'rest-api',
      excerpt: 'Access your help center content programmatically via the REST API.',
      order: 1,
      content: `# REST API

HelpNest exposes a REST API for reading and managing help center content programmatically.

## Authentication

Pass your API key in the Authorization header:

\`\`\`
Authorization: Bearer hn_your_api_key
\`\`\`

## Articles

- GET /api/articles — list published articles
- GET /api/articles/:id — get a single article
- PATCH /api/articles/:id — update an article
- DELETE /api/articles/:id — delete an article

## Collections

- GET /api/collections — list collections
- POST /api/collections — create a collection
- PATCH /api/collections/:id — update a collection
- DELETE /api/collections/:id — delete a collection

> API key management UI and full SDK are coming in Phase 3.`,
    },
  ]

  for (const article of docsArticles) {
    await prisma.article.upsert({
      where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: article.slug } },
      update: {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
      },
      create: {
        workspaceId: docsWorkspace.id,
        authorId: user.id,
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        views: 0,
        ...article,
      },
    })
  }

  console.log(`✅ Seeded ${docsArticles.length} articles`)
  console.log('   http://localhost:3000/helpnest/help → HelpNest docs')
  console.log('   http://localhost:3000/dashboard     → Dashboard')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
