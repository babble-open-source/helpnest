import path from 'node:path'
import { config } from 'dotenv'
config({ path: path.resolve(__dirname, '../../../.env') })
import { PrismaClient, ArticleStatus, MemberRole } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // In production, require explicit credentials so the well-known dev defaults
  // ('admin@helpnest.cloud' / 'helpnest') are never deployed as real admin credentials.
  // The email is public in the OSS repo — if an attacker knows it, brute-force
  // protection is the only barrier. Use a private email + strong password in prod.
  const isProd = process.env.NODE_ENV === 'production'

  const adminEmail = process.env.ADMIN_SEED_EMAIL
    ?? (isProd
      ? (() => { throw new Error('[HelpNest] Set ADMIN_SEED_EMAIL before running db:seed in production.') })()
      : 'admin@helpnest.cloud')

  const adminPassword = process.env.ADMIN_SEED_PASSWORD
    ?? (isProd
      ? (() => { throw new Error('[HelpNest] Set ADMIN_SEED_PASSWORD before running db:seed in production.') })()
      : 'helpnest')

  const defaultPasswordHash = await bcrypt.hash(adminPassword, 12)

  // Create user
  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: defaultPasswordHash,
    },
    create: {
      email: adminEmail,
      name: 'HelpNest Admin',
      avatar: null,
      passwordHash: defaultPasswordHash,
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
    create: { workspaceId: docsWorkspace.id, title: 'Getting Started', description: 'Install and run HelpNest in minutes.', emoji: '🚀', slug: 'getting-started', order: 0, visibility: 'PUBLIC' },
  })

  const colSelfHosting = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'self-hosting' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'Self-Hosting', description: 'Run HelpNest on your own infrastructure.', emoji: '🖥️', slug: 'self-hosting', order: 1, visibility: 'PUBLIC' },
  })

  const colDashboard = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'using-helpnest' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'Using HelpNest', description: 'Managing your help center — articles, collections, themes.', emoji: '✏️', slug: 'using-helpnest', order: 2, visibility: 'PUBLIC' },
  })

  const colIntegrations = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'integrations' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'Integrations', description: 'Widget, API, SDK and third-party integrations.', emoji: '🔌', slug: 'integrations', order: 3, visibility: 'PUBLIC' },
  })

  const colAbout = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'about' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'About', description: 'The story behind HelpNest — why it was built and who built it.', emoji: '💡', slug: 'about', order: 4, visibility: 'PUBLIC' },
  })

  const colMigration = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'migration' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'Migration', description: 'Import your existing content from other platforms into HelpNest.', emoji: '🔄', slug: 'migration', order: 5, visibility: 'PUBLIC' },
  })

  const colAiDraft = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'ai-auto-draft' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'AI Auto-Draft', description: 'Automatically draft KB articles from code changes and unanswered customer questions.', emoji: '✨', slug: 'ai-auto-draft', order: 6, visibility: 'PUBLIC' },
  })

  const colInternal = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'internal-runbooks' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'Internal Runbooks', description: 'Team-only operational guides and procedures.', emoji: '🔒', slug: 'internal-runbooks', order: 7, visibility: 'INTERNAL' },
  })

  const docsArticles = [
    // About
    {
      collectionId: colAbout.id,
      title: 'Why I built HelpNest',
      slug: 'why-i-built-helpnest',
      excerpt: 'The story behind HelpNest — a gap I found while building my own product.',
      order: 0,
      content: `# Why I built HelpNest

While building [Babble](https://trybabble.io/), I hit a moment most product builders eventually face: I needed customer-facing help documentation.

I already had developer docs — but I quickly realised the audience is completely different. A developer is comfortable navigating a sidebar, scanning code snippets, and jumping between sections. A general customer isn't. They land on a page, want a quick answer, and leave if it isn't obvious. The bar for clarity is much higher.

So I did a quick scan of how other companies handle this. Every company I respected had a clean, searchable help center. The pattern was clear. There are excellent tools out there — Intercom, Zendesk, Help Scout — that do this well, and they serve millions of businesses. But I wanted something I could self-host, fully own, and extend without limits.

I searched for open source alternatives. There are several great developer documentation frameworks — Docusaurus, Mintlify, ReadMe — but they are built *for developers, by developers*. I could not find a stable, well-maintained OSS tool focused on the general customer audience.

That gap is why HelpNest exists. A clean, self-hostable help center that your customers — not just your engineers — can actually use. MIT licensed, free forever, built for the world.`,
    },
    {
      collectionId: colAbout.id,
      title: 'Built with gratitude — Claude Code, Anthropic & Next.js',
      slug: 'built-with-gratitude',
      excerpt: 'A thank you to the tools and communities that made HelpNest possible.',
      order: 1,
      content: `# Built with gratitude

HelpNest was designed and built in close collaboration with **Claude Code** (powered by Claude Opus) by Anthropic. From the monorepo architecture and database schema to API routes, UI components, and debugging edge cases — Claude was a thoughtful pair programmer throughout.

What stood out wasn't just speed, but quality of reasoning: catching security issues early, considering trade-offs, and pushing back when a simpler approach existed. Anthropic's commitment to building AI that is honest and genuinely helpful shows in every interaction.

**Next.js** by Vercel is the foundation HelpNest runs on. The App Router, Server Components, and seamless server/client rendering made it possible to ship a fast, themeable, SEO-friendly help center without sacrificing developer experience.

HelpNest also stands on the shoulders of **Tiptap**, **Prisma**, **Tailwind CSS**, **NextAuth.js**, **Qdrant**, and **React Markdown** — and the countless open source contributors behind them. Thank you.`,
    },

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

- **Rich article editor** — Tiptap-powered WYSIWYG editor with tables, task lists, code blocks, and version history
- **Ask AI** — customers can ask questions in natural language and get instant AI-powered answers sourced from your articles
- **Themes & branding** — 8 built-in themes plus full customisation of colours, fonts, border radius, and favicon
- **Embeddable widget** — add a search widget to your product with a single script tag
- **JavaScript SDK** — programmatic access to articles and collections via \`@helpnest/sdk\`
- **Migration CLIs** — import content from Intercom, Mintlify, or Notion with one command
- **Slack bot** — let your team search articles and ask AI from Slack
- **Multi-workspace** — run multiple help centers from one instance
- **Self-hostable** — MIT licensed, deploy on any server

## Who uses help centers like this?

If you're a team that publishes customer-facing support content — FAQs, how-to guides, troubleshooting docs — HelpNest is built for you. It's an open-source option for teams that want full ownership of their knowledge base.`,
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

5. Open http://localhost:3000 and log in with admin@helpnest.cloud / helpnest.

## What the seed creates

The setup script seeds two workspaces:

- **HelpNest docs** at /helpnest/help — the docs you are reading right now
- **HelpNest Cloud support** at /support/help — sample cloud support center`,
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
- **ANTHROPIC_API_KEY** — Required for Ask AI answers (Claude)
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
      content: `<p>The easiest way to run HelpNest in production is with Docker Compose.</p><h2>What is included</h2><p>The provided docker-compose.yml runs:</p><ul><li><p><strong>HelpNest</strong> — the Next.js app (port 3000)</p></li><li><p><strong>PostgreSQL 16</strong> — primary database</p></li><li><p><strong>Redis 7</strong> — caching and sessions</p></li><li><p><strong>Qdrant</strong> — vector database for AI search</p></li></ul><h2>Steps</h2><ol><li><p>Clone the repo on your server</p><pre><code class="language-bash">git clone https://github.com/babble-open-source/helpnest
cd helpnest</code></pre></li><li><p>Create your .env file</p><pre><code class="language-bash">cp .env.example .env</code></pre></li><li><p>Start everything</p><pre><code class="language-bash">docker compose up -d</code></pre></li><li><p>Run migrations and seed</p><pre><code class="language-bash">docker compose exec app pnpm --filter @helpnest/db db:migrate
docker compose exec app pnpm --filter @helpnest/db db:seed</code></pre></li><li><p>Visit your server on port 3000.</p></li></ol><h2>Updating</h2><pre><code class="language-bash">git pull
docker compose build app
docker compose up -d</code></pre>`,
    },
    {
      collectionId: colSelfHosting.id,
      title: 'Custom Domain Setup',
      slug: 'custom-domain',
      excerpt: 'Point a custom domain at your HelpNest help center.',
      order: 1,
      content: `<p>You can serve your help center on a custom domain like help.yourcompany.com.</p><h2>Option 1 — Subdomain (recommended)</h2><ol><li><p>Add a CNAME record pointing <code>help.yourcompany.com</code> to your server's IP address.</p></li><li><p>In your HelpNest dashboard, go to Settings and enter <code>help.yourcompany.com</code> in the Custom Domain field.</p></li><li><p>Set up a reverse proxy to forward requests to the HelpNest app.</p></li></ol><p>Example nginx config:</p><pre><code class="language-nginx">server {
  server_name help.yourcompany.com;
  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}</code></pre><h2>Option 2 — Path prefix</h2><p>If you want <code>yourcompany.com/help</code>, proxy all <code>/help</code> requests to the HelpNest app.</p><h2>SSL</h2><p>Use Certbot with Let's Encrypt for free SSL certificates, or use Caddy which handles SSL automatically.</p>`,
    },

    // Using HelpNest
    {
      collectionId: colDashboard.id,
      title: 'Managing Collections',
      slug: 'managing-collections',
      excerpt: 'Collections group related articles together in your help center.',
      order: 0,
      content: `<p>Collections are the top-level groupings in your help center. Every article belongs to a collection.</p><h2>Creating a collection</h2><ol><li><p>Go to Dashboard &gt; Collections</p></li><li><p>Click <strong>New Collection</strong></p></li><li><p>Choose an emoji, give it a title and optional description</p></li><li><p>Click <strong>Create</strong></p></li></ol><h2>Editing a collection</h2><p>Click the actions menu next to any collection and select <strong>Edit</strong>.</p><h2>Deleting a collection</h2><p>Collections can only be deleted when they have no articles. Move or delete all articles first, then delete the collection.</p>`,
    },
    {
      collectionId: colDashboard.id,
      title: 'Writing and Publishing Articles',
      slug: 'writing-articles',
      excerpt: 'Create and publish help articles using the rich text editor.',
      order: 1,
      content: `<h2>Writing and Publishing Articles</h2><p>HelpNest includes a <strong>full-featured rich text editor</strong> powered by <a href="https://tiptap.dev">Tiptap</a>. This article demonstrates every formatting feature available to you.</p><hr><h2>Creating an article</h2><ol><li><p>Go to <strong>Dashboard &gt; Articles</strong></p></li><li><p>Click <strong>New Article</strong></p></li><li><p>Choose a collection and enter a title</p></li><li><p>Start writing — changes auto-save every 30 seconds</p></li></ol><h2>Text formatting</h2><p>The editor supports all standard inline styles. You can make text <strong>bold</strong>, <em>italic</em>, <u>underlined</u>, or <s>struck through</s>. Combine them freely: <strong><em>bold italic</em></strong>.</p><p>Use backticks for <code>inline code</code> when referencing commands or values inline.</p><blockquote><p>Pro tip: use the bubble menu — select any text to see formatting options appear inline without touching the toolbar.</p></blockquote><h2>Headings and structure</h2><p>Use H2 for top-level sections and H3 for sub-sections. The outline panel on the left tracks all headings and lets you jump to any section instantly.</p><h3>Bullet lists</h3><ul><li><p>Rich text editor powered by Tiptap</p></li><li><p>AI-powered semantic search via OpenAI + Qdrant</p></li><li><p>8 built-in themes — swappable without redeployment</p></li><li><p>Multi-workspace support from one instance</p></li></ul><h3>Numbered lists</h3><ol><li><p>Write the article content</p></li><li><p>Fill in the excerpt and URL slug in the properties panel</p></li><li><p>Click <strong>Publish</strong></p></li></ol><h3>Task lists</h3><p>Use task lists for checklists and step-by-step guides your readers can follow along with:</p><ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked></label><div><p>Create your first collection</p></div></li><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked></label><div><p>Write and publish your first article</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"></label><div><p>Customise your help center theme</p></div></li><li data-checked="false" data-type="taskItem"><label><input type="checkbox"></label><div><p>Embed the search widget on your site</p></div></li></ul><h2>Code blocks</h2><p>Use code blocks for multi-line commands, configuration snippets, or any code your readers need to copy:</p><pre><code class="language-bash">git clone https://github.com/babble-open-source/helpnest
cd helpnest
cp .env.example .env
./scripts/dev-setup.sh
pnpm install &amp;&amp; pnpm dev</code></pre><p>Code blocks support syntax highlighting for bash, JavaScript, TypeScript, JSON, and <a href="https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md">many more languages</a>.</p><h2>Tables</h2><p>Insert tables to compare options or present structured data clearly:</p><table><tbody><tr><th colspan="1" rowspan="1"><p>Panel</p></th><th colspan="1" rowspan="1"><p>Location</p></th><th colspan="1" rowspan="1"><p>Purpose</p></th></tr><tr><td colspan="1" rowspan="1"><p>Outline</p></td><td colspan="1" rowspan="1"><p>Left sidebar</p></td><td colspan="1" rowspan="1"><p>Heading navigation — jump to any section</p></td></tr><tr><td colspan="1" rowspan="1"><p>Properties</p></td><td colspan="1" rowspan="1"><p>Right sidebar</p></td><td colspan="1" rowspan="1"><p>Collection, slug, excerpt, publish status</p></td></tr><tr><td colspan="1" rowspan="1"><p>Toolbar</p></td><td colspan="1" rowspan="1"><p>Top (classic mode)</p></td><td colspan="1" rowspan="1"><p>All formatting controls in one row</p></td></tr></tbody></table><h2>Saving and publishing</h2><p>Changes <strong>auto-save every 30 seconds</strong>. You can also:</p><ul><li><p>Click <strong>Save draft</strong> to save immediately without publishing</p></li><li><p>Click <strong>Publish</strong> to make the article live on your help center</p></li><li><p>Click <strong>Update</strong> to push changes to an already-published article</p></li></ul><hr><h2>Version history</h2><p>Click <strong>History</strong> in the top bar to view all saved versions of the article. Click <strong>Restore</strong> next to any version to roll back — the restored content loads into the editor as an unsaved draft so you can review it before publishing.</p>`,
    },
    {
      collectionId: colDashboard.id,
      title: 'Customising Your Theme',
      slug: 'themes',
      excerpt: 'Change the look of your help center with community-built themes.',
      order: 2,
      content: `<p>HelpNest ships with 8 built-in themes from the <code>@helpnest/themes</code> package, plus full customisation options.</p><h2>Changing the theme</h2><ol><li><p>Go to Dashboard &gt; Settings</p></li><li><p>Browse the theme gallery under <strong>Help Center Theme</strong></p></li><li><p>Click a theme to select it</p></li><li><p>Click <strong>Apply theme</strong></p></li></ol><p>The theme is applied instantly — no redeploy needed.</p><h2>Available themes</h2><ul><li><p><strong>Default</strong> — Warm cream with Lora headings</p></li><li><p><strong>Dark</strong> — Inverted warm tones</p></li><li><p><strong>Ocean</strong> — Clean blues, corporate feel</p></li><li><p><strong>Forest</strong> — Deep earthy greens</p></li><li><p><strong>Aurora</strong> — Violet with Syne</p></li><li><p><strong>Slate</strong> — Neutral grays, enterprise</p></li><li><p><strong>Rose</strong> — Soft pinks with Playfair Display</p></li><li><p><strong>Midnight</strong> — Deep navy</p></li></ul><h2>Custom colours and fonts</h2><p>Beyond the preset themes, you can override individual design tokens from Settings:</p><ul><li><p><strong>Colours</strong> — customise cream (background), ink (text), accent, border, muted, and green independently</p></li><li><p><strong>Fonts</strong> — choose from font presets or provide custom heading, body, and brand font families with Google Fonts URLs</p></li><li><p><strong>Border radius</strong> — choose from none, sm, md, lg, or xl</p></li><li><p><strong>Favicon</strong> — upload a custom favicon for your help center</p></li></ul><h2>AI theme generator</h2><p>Describe the look you want in plain English and let AI generate a theme for you. Go to Settings and click <strong>Generate with AI</strong> to try it.</p><h2>Community themes</h2><p>Additional themes are available from the <code>@helpnest/themes</code> npm package. See the helpnest-themes repository for contribution guidelines.</p>`,
    },

    // Integrations
    {
      collectionId: colIntegrations.id,
      title: 'Embeddable Widget',
      slug: 'widget',
      excerpt: 'Embed a help widget on any website with a single script tag.',
      order: 0,
      content: `<p>The HelpNest widget lets your customers search your help center from any page on your site.</p><h2>Installation</h2><p>Add the following snippet before the closing <code>&lt;/body&gt;</code> tag on your website:</p><pre><code class="language-html">&lt;script
  src="https://your-domain.com/api/widget.js"
  data-workspace="your-workspace-slug"
  async
&gt;&lt;/script&gt;</code></pre><p>Replace <code>your-workspace-slug</code> with your workspace slug from Settings.</p><h2>Configuration</h2><p>The widget supports these optional data attributes on the script tag:</p><ul><li><p><code>data-workspace</code> (required) — your workspace slug</p></li><li><p><code>data-position</code> — <code>bottom-right</code> (default) or <code>bottom-left</code></p></li><li><p><code>data-title</code> — custom heading text (default: "How can we help?")</p></li><li><p><code>data-baseUrl</code> — override the API base URL (defaults to the script origin)</p></li></ul><h2>Self-hosted</h2><p>The widget script is served from your HelpNest instance at <code>/api/widget.js</code>. It automatically uses your workspace's theme colours.</p><h2>How it works</h2><p>The widget loads lazily after the page is idle, opens a search panel when clicked, and displays results from your published articles. Customers can click through to the full article on your help center.</p>`,
    },
    {
      collectionId: colIntegrations.id,
      title: 'REST API',
      slug: 'rest-api',
      excerpt: 'Access your help center content programmatically via the REST API.',
      order: 1,
      content: `<p>HelpNest exposes a REST API for reading and managing help center content programmatically.</p><h2>Authentication</h2><p>Create an API key from <strong>Settings → API Keys</strong> in the dashboard. Pass it in the Authorization header:</p><pre><code class="language-bash">Authorization: Bearer hn_live_your_api_key</code></pre><h2>Articles</h2><ul><li><p><code>GET /api/articles</code> — list published articles</p></li><li><p><code>GET /api/articles/:id</code> — get a single article</p></li><li><p><code>PATCH /api/articles/:id</code> — update an article</p></li><li><p><code>DELETE /api/articles/:id</code> — delete an article</p></li></ul><h2>Collections</h2><ul><li><p><code>GET /api/collections</code> — list collections</p></li><li><p><code>POST /api/collections</code> — create a collection</p></li><li><p><code>PATCH /api/collections/:id</code> — update a collection</p></li><li><p><code>DELETE /api/collections/:id</code> — delete a collection</p></li></ul><h2>Other endpoints</h2><ul><li><p><code>GET /api/search?q=...</code> — full-text search</p></li><li><p><code>POST /api/ai-search</code> — AI-powered semantic search</p></li><li><p><code>GET /api/health</code> — health check</p></li></ul><h2>JavaScript SDK</h2><p>For a typed client, use the <code>@helpnest/sdk</code> package:</p><pre><code class="language-typescript">import { HelpNest } from '@helpnest/sdk'

const client = new HelpNest({
  apiKey: 'hn_live_xxx',
  workspace: 'your-slug',
})

const articles = await client.articles.list({ status: 'PUBLISHED' })
const article = await client.articles.get('article-slug')</code></pre>`,
    },
    {
      collectionId: colIntegrations.id,
      title: 'Ask AI',
      slug: 'ask-ai',
      excerpt: 'Let your customers ask questions in natural language and get instant AI-powered answers.',
      order: 2,
      content: `<p><strong>Ask AI</strong> is a built-in feature that lets your customers type a question in plain English and receive an instant answer sourced from your published articles.</p><h2>How it works</h2><ol><li><p>A customer clicks <strong>Ask AI</strong> on your help center</p></li><li><p>They type a question (e.g. "How do I reset my password?")</p></li><li><p>HelpNest searches your articles using semantic vector search</p></li><li><p>The most relevant content is passed to Claude (Anthropic) which generates a clear, concise answer</p></li><li><p>Source articles are shown below the answer so the customer can read more</p></li></ol><h2>Requirements</h2><p>Ask AI requires two API keys in your environment:</p><ul><li><p><code>OPENAI_API_KEY</code> — used to generate article embeddings</p></li><li><p><code>ANTHROPIC_API_KEY</code> — used to generate the AI answer via Claude</p></li></ul><p>You also need Qdrant running for vector storage (included in Docker Compose).</p><h2>Syncing embeddings</h2><p>After publishing or updating articles, trigger an embedding sync from <strong>Settings → AI Search</strong> or via the API at <code>POST /api/embeddings/sync</code>.</p>`,
    },
    {
      collectionId: colIntegrations.id,
      title: 'Slack Bot',
      slug: 'slack-bot',
      excerpt: 'Search your help center and ask AI questions directly from Slack.',
      order: 3,
      content: `<p>The HelpNest Slack bot lets your team search articles and get AI answers without leaving Slack.</p><h2>Commands</h2><ul><li><p><code>/helpnest [query]</code> — keyword search across your published articles (results shown privately)</p></li><li><p><code>/helpnest-ask [question]</code> — ask a question and get an AI-powered answer with source links</p></li></ul><h2>Setup</h2><ol><li><p>Clone the <code>helpnest-slack</code> repository</p></li><li><p>Create a Slack app at <a href="https://api.slack.com/apps">api.slack.com/apps</a> with slash commands</p></li><li><p>Set the following environment variables:</p><pre><code>SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
HELPNEST_URL=https://your-helpnest-instance.com
HELPNEST_API_KEY=hn_live_...
HELPNEST_WORKSPACE=your-slug</code></pre></li><li><p>Run the bot with <code>npm run dev</code> (use ngrok for local Slack events)</p></li></ol>`,
    },

    // Migration
    {
      collectionId: colMigration.id,
      title: 'Migrating from Intercom',
      slug: 'migrating-from-intercom',
      excerpt: 'Import your Intercom Articles into HelpNest with a single command.',
      order: 0,
      content: `<p>The <code>helpnest-intercom</code> CLI imports your Intercom Articles collections and articles into HelpNest.</p><h2>What gets imported</h2><ul><li><p>Intercom collections become HelpNest collections</p></li><li><p>Intercom articles are converted from HTML to Markdown and imported as HelpNest articles</p></li><li><p>Article ordering is preserved</p></li></ul><h2>Usage</h2><pre><code class="language-bash">npx helpnest-intercom migrate \\
  --intercom-token YOUR_INTERCOM_TOKEN \\
  --helpnest-url https://your-helpnest.com \\
  --helpnest-key hn_live_xxx</code></pre><h2>Dry run</h2><p>Add <code>--dry-run</code> to preview what will be imported without making any changes:</p><pre><code class="language-bash">npx helpnest-intercom migrate \\
  --intercom-token YOUR_TOKEN \\
  --helpnest-url https://your-helpnest.com \\
  --helpnest-key hn_live_xxx \\
  --dry-run</code></pre><h2>Getting your Intercom token</h2><p>Go to Intercom Settings → Integrations → Developer Hub → Create an app → Generate an access token with read permissions for Articles.</p>`,
    },
    {
      collectionId: colMigration.id,
      title: 'Migrating from Notion',
      slug: 'migrating-from-notion',
      excerpt: 'Import a Notion database of articles into HelpNest.',
      order: 1,
      content: `<p>The <code>helpnest-notion</code> CLI imports pages from a Notion database into HelpNest as articles.</p><h2>What gets imported</h2><ul><li><p>Each Notion page becomes a HelpNest article</p></li><li><p>Notion page content is converted to Markdown</p></li><li><p>You can map a Notion property to the HelpNest collection</p></li></ul><h2>Usage</h2><pre><code class="language-bash">npx helpnest-notion migrate \\
  --notion-key YOUR_NOTION_KEY \\
  --database YOUR_DATABASE_ID \\
  --helpnest-url https://your-helpnest.com \\
  --helpnest-key hn_live_xxx</code></pre><h2>Incremental sync</h2><p>Use the <code>--state</code> flag to save sync state to a file. On subsequent runs, only new or updated pages are imported:</p><pre><code class="language-bash">npx helpnest-notion migrate \\
  --notion-key YOUR_KEY \\
  --database YOUR_DB \\
  --helpnest-url https://your-helpnest.com \\
  --helpnest-key hn_live_xxx \\
  --state ./notion-sync-state.json</code></pre><h2>Getting your Notion credentials</h2><p>Create an integration at <a href="https://www.notion.so/my-integrations">notion.so/my-integrations</a>, then share the database with the integration. The database ID is in the URL when you open the database.</p>`,
    },
    // AI Auto-Draft
    {
      collectionId: colAiDraft.id,
      title: 'AI Auto-Draft — Overview',
      slug: 'ai-auto-draft-overview',
      excerpt: 'Automatically draft KB articles from PR merges and unanswered customer questions.',
      order: 0,
      content: `<p>AI Auto-Draft keeps your knowledge base in sync with your product automatically. Instead of writing articles by hand after every release, HelpNest can draft them for you — triggered by code changes or by gaps in customer support coverage.</p><h2>Two triggers</h2><h3>Proactive: code changes</h3><p>When a PR is merged in your GitHub repository, a GitHub Action sends the PR title, description, and optionally a code diff to HelpNest. The AI drafts or updates an article about what changed. This runs in your CI pipeline and never fails the build.</p><h3>Reactive: knowledge gaps</h3><p>When a customer asks a question your AI cannot answer (confidence below threshold), HelpNest records it as a knowledge gap. Once the same question has been asked a configurable number of times, HelpNest automatically drafts an article to fill that gap.</p><h2>Review queue</h2><p>All AI-generated content lands in a draft state — never published automatically. A human reviews, edits if needed, and publishes. The dashboard overview shows counts for <strong>AI Drafts to Review</strong> and <strong>AI Article Updates</strong>, with direct links to filter the article list.</p><h2>Two modes</h2><ul><li><p><strong>Create mode</strong> — AI writes a brand-new DRAFT article when the topic is not yet covered in your KB (RAG similarity score below 0.85)</p></li><li><p><strong>Update mode</strong> — AI proposes changes to an existing published article when the topic is closely related (score at or above 0.85). The update is stored as a draft edit — the live article is unchanged until a human publishes it.</p></li></ul><h2>Safety</h2><ul><li><p>Distributed lock prevents duplicate drafts for the same topic running in parallel</p></li><li><p>Rate limit of 20 drafts per hour per workspace applies to API-triggered drafts</p></li><li><p>Idempotency key prevents duplicate drafts from CI re-runs</p></li><li><p>HTML output is sanitised through a whitelist before storage — no XSS possible</p></li><li><p>All AI drafts are scoped to the workspace — no cross-workspace data leaks</p></li></ul>`,
    },
    {
      collectionId: colAiDraft.id,
      title: 'Auto-Draft: From Knowledge Gaps',
      slug: 'auto-draft-knowledge-gaps',
      excerpt: 'Draft articles automatically when customers ask questions your AI cannot answer.',
      order: 1,
      content: `<p>When a customer asks a question and the AI cannot find a good answer (confidence below the escalation threshold), HelpNest records it as a <strong>knowledge gap</strong>. Once the same question has been asked enough times, an article draft is created automatically.</p><h2>How it works</h2><ol><li><p>Customer sends a message in the chat widget</p></li><li><p>The AI answers using your published articles</p></li><li><p>If confidence is below 0.3, the question is recorded as a knowledge gap (normalised and deduplicated by hash)</p></li><li><p>When occurrences of that question reach the configured threshold, a DRAFT article is created</p></li><li><p>The gap is linked to the draft — it will be marked resolved once the article is published</p></li></ol><h2>Configuring the threshold</h2><p>Go to <strong>Settings → AI Agent → Auto-Draft: From Unanswered Questions</strong>.</p><ul><li><p><strong>Toggle</strong> — enable or disable reactive auto-drafting entirely</p></li><li><p><strong>Occurrence threshold</strong> — default is 2. Set to 1 to draft on the first occurrence, or higher to wait for more signal before drafting</p></li></ul><h2>Viewing knowledge gaps</h2><p>The dashboard overview shows a <strong>Knowledge Gaps</strong> count when AI conversations are enabled. This reflects all unresolved gaps. Go to the Conversations section to see individual gaps and their occurrence counts.</p><h2>Reviewing the draft</h2><p>When a gap triggers a draft, it appears in <strong>Dashboard → Articles → AI Drafts</strong>. The editor shows a banner: <em>"AI Draft — Created automatically from a customer question. Review carefully before publishing."</em></p>`,
    },
    {
      collectionId: colAiDraft.id,
      title: 'Auto-Draft: GitHub Action',
      slug: 'auto-draft-github-action',
      excerpt: 'Draft articles automatically when a PR is merged using the HelpNest GitHub Action.',
      order: 2,
      content: `<p>The <code>helpnest/draft-article-action</code> GitHub Action fires after a PR is merged and sends the PR details to HelpNest, which drafts or updates a KB article.</p><h2>Setup</h2><p>Add a workflow file to your repository:</p><pre><code class="language-yaml"># .github/workflows/helpnest-draft.yml
name: HelpNest Draft Article
on:
  pull_request:
    types: [closed]
jobs:
  draft:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: helpnest/draft-article-action@v1
        with:
          api-key: \${{ secrets.HELPNEST_API_KEY }}
          workspace: your-workspace-slug
          github-token: \${{ secrets.GITHUB_TOKEN }}</code></pre><h2>Inputs</h2><table><thead><tr><th><p>Input</p></th><th><p>Required</p></th><th><p>Default</p></th><th><p>Description</p></th></tr></thead><tbody><tr><td><p><code>api-key</code></p></td><td><p>Yes</p></td><td><p></p></td><td><p>HelpNest API key from Settings → API Keys</p></td></tr><tr><td><p><code>workspace</code></p></td><td><p>Yes</p></td><td><p></p></td><td><p>Your workspace slug</p></td></tr><tr><td><p><code>github-token</code></p></td><td><p>Yes</p></td><td><p></p></td><td><p>GitHub token (use <code>secrets.GITHUB_TOKEN</code>)</p></td></tr><tr><td><p><code>base-url</code></p></td><td><p>No</p></td><td><p>https://helpnest.cloud</p></td><td><p>Override for self-hosted instances</p></td></tr><tr><td><p><code>collection</code></p></td><td><p>No</p></td><td><p></p></td><td><p>Target collection ID or slug</p></td></tr><tr><td><p><code>feature-id</code></p></td><td><p>No</p></td><td><p></p></td><td><p>Shared ID for multi-repo batching</p></td></tr><tr><td><p><code>send-diff</code></p></td><td><p>No</p></td><td><p>false</p></td><td><p>Send code diff (opt-in — code stays in CI by default)</p></td></tr><tr><td><p><code>skip-labels</code></p></td><td><p>No</p></td><td><p>no-docs,chore,dependencies,deps,ci,refactor</p></td><td><p>PR labels that skip article generation</p></td></tr></tbody></table><h2>Privacy</h2><p>By default the action only sends the PR title, description, repository name, and PR URL. Code never leaves your CI environment unless you explicitly set <code>send-diff: true</code>.</p><h2>Failure behaviour</h2><p>The action <strong>never fails your build</strong>. If HelpNest is unreachable or returns an error, the step emits a warning and passes. CI is never blocked.</p><h2>Prerequisites</h2><p>Enable external API drafting in <strong>Settings → AI Agent → Auto-Draft: From Code Changes</strong>. Create an API key from <strong>Settings → API Keys</strong> and store it as a repository secret (<code>HELPNEST_API_KEY</code>).</p>`,
    },
    {
      collectionId: colAiDraft.id,
      title: 'Auto-Draft: CLI (helpnest draft)',
      slug: 'auto-draft-cli',
      excerpt: 'Trigger article drafts from the command line — works with any CI system.',
      order: 3,
      content: `<p>The <code>helpnest draft</code> command lets you trigger article drafts from any CI environment — GitLab CI, Jenkins, CircleCI, Bitbucket Pipelines, or a local terminal.</p><h2>Usage</h2><pre><code class="language-bash"># Minimal — just a PR title
HELPNEST_API_KEY=hn_live_xxx HELPNEST_WORKSPACE=myproduct \\
helpnest draft --pr-title "Add dark mode toggle"

# With description
helpnest draft \\
  --api-key hn_live_xxx \\
  --workspace myproduct \\
  --pr-title "Add dark mode" \\
  --pr-body "Users can now toggle dark mode in Settings &gt; Appearance"

# With diff (opt-in)
helpnest draft \\
  --workspace myproduct \\
  --pr-title "Add dark mode" \\
  --diff "\$(git diff main...HEAD -- 'src/' ':!*.test.*' | head -150)" \\
  --collection new-features

# Multi-repo batching
helpnest draft \\
  --workspace myproduct \\
  --feature-id FEAT-1234 \\
  --pr-title "Dark mode API endpoint"</code></pre><h2>Options</h2><table><thead><tr><th><p>Option</p></th><th><p>Description</p></th></tr></thead><tbody><tr><td><p><code>--pr-title</code></p></td><td><p>PR or change title (required)</p></td></tr><tr><td><p><code>--pr-body</code></p></td><td><p>PR description</p></td></tr><tr><td><p><code>--diff</code></p></td><td><p>Code diff (opt-in)</p></td></tr><tr><td><p><code>--collection</code></p></td><td><p>Target collection ID</p></td></tr><tr><td><p><code>--feature-id</code></p></td><td><p>Shared feature ID for multi-repo batching</p></td></tr><tr><td><p><code>--api-key</code></p></td><td><p>API key (or set <code>HELPNEST_API_KEY</code>)</p></td></tr><tr><td><p><code>--workspace</code></p></td><td><p>Workspace slug (or set <code>HELPNEST_WORKSPACE</code>)</p></td></tr><tr><td><p><code>--base-url</code></p></td><td><p>HelpNest base URL (default: https://helpnest.cloud)</p></td></tr></tbody></table><h2>Environment variables</h2><p>Set <code>HELPNEST_API_KEY</code> and <code>HELPNEST_WORKSPACE</code> to avoid passing flags every time. In GitLab CI, add them as CI/CD variables. In Jenkins, use Credentials Binding.</p><h2>Output</h2><pre><code>Draft created: "Dark Mode in HelpNest"
Edit: https://helpnest.cloud/dashboard/articles/clxxx/edit</code></pre>`,
    },
    {
      collectionId: colAiDraft.id,
      title: 'Multi-Repo Feature Batching',
      slug: 'multi-repo-batching',
      excerpt: 'Combine PR context from multiple repos into one article using a shared feature ID.',
      order: 4,
      content: `<p>When a feature spans multiple repositories — for example, a backend API change and a frontend UI change for the same feature — you can collect all the PR context before generating a single, coherent article.</p><h2>How it works</h2><ol><li><p>Each repo's workflow sends its PR context to HelpNest with a shared <code>feature-id</code></p></li><li><p>HelpNest accumulates the contexts in Redis (up to 24 hours)</p></li><li><p>After the batch window has elapsed since the last PR, the batch processor combines all contexts and generates one article</p></li></ol><h2>GitHub Action setup</h2><pre><code class="language-yaml"># backend repo
- uses: helpnest/draft-article-action@v1
  with:
    api-key: \${{ secrets.HELPNEST_API_KEY }}
    workspace: myproduct
    github-token: \${{ secrets.GITHUB_TOKEN }}
    feature-id: FEAT-1234   # same ID in all repos

# frontend repo
- uses: helpnest/draft-article-action@v1
  with:
    api-key: \${{ secrets.HELPNEST_API_KEY }}
    workspace: myproduct
    github-token: \${{ secrets.GITHUB_TOKEN }}
    feature-id: FEAT-1234   # same ID</code></pre><h2>CLI setup</h2><pre><code class="language-bash">helpnest draft --workspace myproduct --feature-id FEAT-1234 --pr-title "Dark mode API"
helpnest draft --workspace myproduct --feature-id FEAT-1234 --pr-title "Dark mode UI toggle"</code></pre><h2>Batch window</h2><p>Configure the wait time in <strong>Settings → AI Agent → Auto-Draft: From Code Changes → Multi-repo batch window</strong>. The default is 60 minutes. After the last PR for a feature-id, HelpNest waits this long before generating the combined article.</p><h2>Requirements</h2><p>Multi-repo batching requires Redis. It uses <code>POST /api/ai/push-feature-context</code> to accumulate contexts and a cron job at <code>GET /api/ai/process-pending-drafts</code> to drain the queue. On Vercel, add a cron entry to <code>vercel.json</code>:</p><pre><code class="language-json">{ "crons": [{ "path": "/api/ai/process-pending-drafts", "schedule": "*/15 * * * *" }] }</code></pre>`,
    },
    {
      collectionId: colAiDraft.id,
      title: 'Reviewing AI Drafts',
      slug: 'reviewing-ai-drafts',
      excerpt: 'Find, review, edit, and publish AI-generated articles from the dashboard.',
      order: 5,
      content: `<p>All AI-generated content lands as a draft — never published automatically. This article explains how to find and review AI drafts.</p><h2>Finding AI drafts</h2><p>The <strong>Overview</strong> dashboard shows two cards when AI drafts exist:</p><ul><li><p><strong>AI Drafts to Review</strong> — new DRAFT articles generated by AI. Click to go directly to the filtered article list.</p></li><li><p><strong>AI Article Updates</strong> — proposed edits to existing published articles. Click to see which articles have pending AI suggestions.</p></li></ul><p>You can also filter from <strong>Dashboard → Articles</strong> using the <strong>AI Drafts</strong> or <strong>AI Updates</strong> tabs in the status filter row. AI draft articles show an <strong>AI</strong> badge pill next to their title.</p><h2>Draft banner</h2><p>When you open an AI-generated draft, a dismissible banner appears at the top of the editor:</p><ul><li><p><strong>For new drafts:</strong> "AI Draft — Created automatically from a customer question or code change. Review carefully before publishing."</p></li><li><p><strong>For update suggestions:</strong> "AI Update Suggested — AI proposes changes based on a recent code change. Review the proposed update below before publishing."</p></li></ul><h2>Review checklist</h2><ul><li><p>Check that the article title is specific and accurate</p></li><li><p>Verify all facts — AI may hallucinate details not in the source material</p></li><li><p>Adjust tone to match your help center's voice</p></li><li><p>Add screenshots or diagrams if helpful</p></li><li><p>Set the correct collection</p></li><li><p>Write a clear excerpt for the article list</p></li></ul><h2>Publishing</h2><p>When satisfied, click <strong>Publish</strong>. For update suggestions, click <strong>Update</strong> to replace the live content. The AI banner disappears after publishing.</p><h2>Disabling auto-draft</h2><p>To stop generating drafts from knowledge gaps or code changes, toggle the relevant option off in <strong>Settings → AI Agent</strong>.</p>`,
    },

    // Migration articles
    {
      collectionId: colMigration.id,
      title: 'Migrating from Mintlify',
      slug: 'migrating-from-mintlify',
      excerpt: 'Import your Mintlify documentation into HelpNest.',
      order: 2,
      content: `<p>The <code>helpnest-mintlify</code> CLI reads a Mintlify docs directory and imports its content into HelpNest.</p><h2>What gets imported</h2><ul><li><p>Navigation groups from <code>mint.json</code> become HelpNest collections</p></li><li><p>MDX and Markdown files are converted to plain Markdown (JSX components are stripped)</p></li><li><p>Article ordering follows the nav structure</p></li></ul><h2>Usage</h2><pre><code class="language-bash">npx helpnest-mintlify migrate \\
  --docs-dir ./docs \\
  --helpnest-url https://your-helpnest.com \\
  --helpnest-key hn_live_xxx</code></pre><h2>Dry run</h2><p>Preview the import without creating anything:</p><pre><code class="language-bash">npx helpnest-mintlify migrate \\
  --docs-dir ./docs \\
  --helpnest-url https://your-helpnest.com \\
  --helpnest-key hn_live_xxx \\
  --dry-run</code></pre>`,
    },

    // Internal article (team-only)
    {
      collectionId: colInternal.id,
      title: 'Incident Response Playbook',
      slug: 'incident-response-playbook',
      excerpt: 'Step-by-step guide for handling production incidents.',
      order: 0,
      content: `<h2>Severity levels</h2><ul><li><p><strong>SEV-1</strong> — Service is down for all users. Page the on-call immediately.</p></li><li><p><strong>SEV-2</strong> — Major feature degraded. Acknowledge within 15 minutes.</p></li><li><p><strong>SEV-3</strong> — Minor issue affecting a subset of users. Fix during business hours.</p></li></ul><h2>Response steps</h2><ol><li><p>Acknowledge the alert and join the incident channel</p></li><li><p>Assess scope and assign severity</p></li><li><p>Communicate status to stakeholders</p></li><li><p>Investigate root cause and implement fix</p></li><li><p>Write post-mortem within 48 hours</p></li></ol><p>This article is only visible to workspace members.</p>`,
    },
  ]

  for (const article of docsArticles) {
    await prisma.article.upsert({
      where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: article.slug } },
      update: {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        isSeeded: true,
      },
      create: {
        workspaceId: docsWorkspace.id,
        authorId: user.id,
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        views: 0,
        isSeeded: true,
        ...article,
      },
    })
  }

  console.log(`✅ Seeded ${docsArticles.length} articles into 'helpnest' workspace`)

  // ── support.helpnest.cloud workspace ──────────────────────────────────────
  // HelpNest Cloud customer support — articles about billing, accounts, etc.
  const supportWorkspace = await prisma.workspace.upsert({
    where: { slug: 'support' },
    update: {},
    create: {
      name: 'HelpNest Cloud',
      slug: 'support',
      logo: null,
      themeId: 'default',
    },
  })

  await prisma.member.upsert({
    where: { workspaceId_userId: { workspaceId: supportWorkspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: supportWorkspace.id, userId: user.id, role: MemberRole.OWNER },
  })

  const sColAccount = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: supportWorkspace.id, slug: 'account' } },
    update: {},
    create: { workspaceId: supportWorkspace.id, title: 'Account & Team', description: 'Managing your HelpNest Cloud account, workspaces, and team members.', emoji: '👤', slug: 'account', order: 0, visibility: 'PUBLIC' },
  })

  const sColBilling = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: supportWorkspace.id, slug: 'billing' } },
    update: {},
    create: { workspaceId: supportWorkspace.id, title: 'Billing & Plans', description: 'Subscriptions, invoices, and plan limits.', emoji: '💳', slug: 'billing', order: 1, visibility: 'PUBLIC' },
  })

  const sColSetup = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: supportWorkspace.id, slug: 'setup' } },
    update: {},
    create: { workspaceId: supportWorkspace.id, title: 'Getting Set Up', description: 'First steps after signing up for HelpNest Cloud.', emoji: '🚀', slug: 'setup', order: 2, visibility: 'PUBLIC' },
  })

  const sColDomain = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: supportWorkspace.id, slug: 'custom-domain' } },
    update: {},
    create: { workspaceId: supportWorkspace.id, title: 'Custom Domains', description: 'Serve your help center on your own domain.', emoji: '🌐', slug: 'custom-domain', order: 3, visibility: 'PUBLIC' },
  })

  const supportArticles = [
    // Account & Team
    {
      collectionId: sColAccount.id,
      title: 'Creating a workspace',
      slug: 'creating-a-workspace',
      excerpt: 'A workspace is your help center. You can create one during sign-up.',
      order: 0,
      content: `# Creating a workspace

When you sign up for HelpNest Cloud, a workspace is created automatically. You can rename it, change its URL slug, and customise its theme from Settings.

## Workspace URL

Your help center is available at:

\`\`\`
https://{your-slug}.helpnest.cloud
\`\`\`

You can also set up a custom domain so customers see your own brand URL (e.g. help.yourcompany.com).

## Workspace name and slug

The workspace **name** appears in your help center header and in your customers' browser tab. The **slug** is the subdomain of your help center URL. Changing the slug changes the URL — update any links or bookmarks after doing so.`,
    },
    {
      collectionId: sColAccount.id,
      title: 'Inviting team members',
      slug: 'inviting-team-members',
      excerpt: 'Add support writers and editors to your workspace.',
      order: 1,
      content: `# Inviting team members

You can invite colleagues to help write and manage your help center.

## How to invite

1. Go to **Settings → Team**
2. Enter the email address of the person you want to invite
3. Choose their role and click **Send invite**
4. They will receive an email with a link to accept the invitation

## Roles

| Role | What they can do |
|------|-----------------|
| Owner | Full access, including billing and workspace deletion |
| Admin | Manage articles, collections, members, and settings |
| Editor | Create and edit articles and collections |
| Viewer | Read-only access to the dashboard |

## Seat limits

The number of members you can invite depends on your plan:

- **Free** — up to 3 members
- **Pro** — up to 10 members
- **Business** — up to 50 members`,
    },
    {
      collectionId: sColAccount.id,
      title: 'Changing your name or email',
      slug: 'profile-settings',
      excerpt: 'Update your personal profile from the Settings page.',
      order: 2,
      content: `# Changing your name or email

You can update your display name and password from your profile settings.

## How to update your profile

1. Go to **Settings → Profile**
2. Update your name
3. To change your password, enter a new password and confirm it
4. Click **Save changes**

> Email address changes are not yet supported. If you need to change your email, contact support.`,
    },

    // Getting Set Up
    {
      collectionId: sColSetup.id,
      title: 'Your first article',
      slug: 'your-first-article',
      excerpt: 'Publish your first help article in under 5 minutes.',
      order: 0,
      content: `# Your first article

Publishing your first article takes just a few minutes.

## Step 1 — Create a collection

Articles live inside collections. Go to **Dashboard → Collections** and click **New Collection**. Give it a name like "Getting Started" and choose an emoji.

## Step 2 — Write the article

Go to **Dashboard → Articles** and click **New Article**. Select your collection, give the article a title, and start writing.

The editor supports:

- **Bold**, *italic*, headings
- Bullet and numbered lists
- Code blocks
- Blockquotes
- Links and images

## Step 3 — Publish

Click **Publish** in the top right. Your article is now live at your help center URL.

## Step 4 — Share your help center

Copy your help center URL from the dashboard and share it with your customers, or embed the search widget on your site.`,
    },
    {
      collectionId: sColSetup.id,
      title: 'Customising your help center theme',
      slug: 'customising-theme',
      excerpt: 'Pick a theme that matches your brand.',
      order: 1,
      content: `# Customising your help center theme

HelpNest Cloud comes with 8 built-in themes, plus full customisation of colours, fonts, and more.

## How to change your theme

1. Go to **Settings → Help Center Theme**
2. Browse the available themes
3. Click a theme card to preview it
4. Click **Apply theme**

The theme is applied immediately — no downtime, no redeploy.

## Available themes

- **Default** — Warm cream with Lora headings
- **Dark** — Inverted warm tones for a dark-mode feel
- **Ocean** — Clean blues, corporate feel
- **Forest** — Deep earthy greens
- **Aurora** — Violet with Syne
- **Slate** — Neutral grays, enterprise look
- **Rose** — Soft pinks with Playfair Display
- **Midnight** — Deep navy

## Custom branding

Beyond themes, you can fine-tune individual design tokens from Settings:

- **Colours** — override background, text, accent, border, and other colours independently
- **Fonts** — pick from font presets or enter custom Google Fonts URLs for headings, body, and brand text
- **Border radius** — adjust the roundness of cards, buttons, and inputs
- **Favicon** — upload a custom favicon
- **AI theme generator** — describe the look you want in plain English and let AI create a theme for you`,
    },

    // Billing
    {
      collectionId: sColBilling.id,
      title: 'Plans and pricing',
      slug: 'plans-and-pricing',
      excerpt: 'Overview of HelpNest Cloud plans and what each includes.',
      order: 0,
      content: `# Plans and pricing

HelpNest Cloud is currently in early access. All new accounts start on the **Free plan** at no cost.

## Free plan

The Free plan includes everything you need to get started:

- Up to **25 published articles**
- Up to **3 team members**
- **50 AI search queries** per month
- **1,000 API calls** per month
- Your own \`{slug}.helpnest.cloud\` subdomain

## Paid plans

Pro and Business plans are coming soon with higher limits and custom domain support. You will be notified when they are available.

## Self-hosting

If you need unlimited usage, you can self-host HelpNest for free under the MIT license. See the [self-hosting guide](https://helpnest.cloud/helpnest/help/self-hosting).`,
    },
    {
      collectionId: sColBilling.id,
      title: 'Usage limits',
      slug: 'usage-limits',
      excerpt: 'What counts toward your plan limits and how to check usage.',
      order: 1,
      content: `# Usage limits

Your dashboard shows a live view of your current usage.

## What counts

- **Articles** — the total number of published articles in your workspace
- **Members** — team members with an active seat (excludes deactivated members)
- **AI queries** — searches that trigger the AI semantic search engine
- **API calls** — any request made using an API key

## Checking your usage

Go to **Dashboard** to see a usage summary with progress bars for each limit.

## What happens when you hit a limit

- **Articles** — you can still edit existing articles but cannot publish new ones until you archive some or upgrade
- **Members** — you can still manage existing members but cannot send new invites
- **AI queries** — falls back to keyword search automatically; no errors shown to customers
- **API calls** — requests return a 429 error

Usage resets on the first of each month.`,
    },

    // AI Auto-Draft (support workspace)
    {
      collectionId: sColSetup.id,
      title: 'Setting up AI Auto-Draft',
      slug: 'setting-up-auto-draft',
      excerpt: 'Automatically generate KB article drafts from code changes and unanswered questions.',
      order: 2,
      content: `# Setting up AI Auto-Draft

AI Auto-Draft generates knowledge base article drafts for you — either when a PR is merged in your codebase or when customers ask questions your AI cannot answer.

## Step 1 — Enable AI

AI must be enabled before auto-draft will work. Go to **Settings → AI Agent**, toggle AI on, configure your provider and API key, then click **Save AI Settings**.

## Step 2 — Configure auto-draft settings

Under **Settings → AI Agent**, you will find two auto-draft sections:

**Auto-Draft: From Unanswered Questions**

Toggle this on to automatically draft articles when customers ask questions the AI cannot answer. Configure the occurrence threshold — the default of 2 means the same question must be asked twice before a draft is created.

**Auto-Draft: From Code Changes**

Toggle this on to allow GitHub Actions and CI pipelines to trigger drafts via your API key. Set the multi-repo batch window (default: 60 minutes) if you use feature IDs across multiple repositories.

## Step 3 — Add product context

Under **Settings → AI Agent → Product Context**, describe your product, target users, and key terminology. The AI uses this when generating articles to match your brand voice and product language.

Example:

> We build a project management tool for remote software teams. Key features: boards, sprints, tasks, time tracking. Users: developers and engineering managers. Tone: direct, practical, friendly.

## Step 4 — Connect your CI (optional)

To auto-draft from code changes, add the GitHub Action to any repository:

\`\`\`yaml
- uses: helpnest/draft-article-action@v1
  with:
    api-key: \${{ secrets.HELPNEST_API_KEY }}
    workspace: your-workspace-slug
    github-token: \${{ secrets.GITHUB_TOKEN }}
\`\`\`

Create an API key from **Settings → API Keys** and add it to your repository secrets.

## Reviewing drafts

All AI-generated content is created as a draft — never published automatically. Check the **Overview** dashboard for "AI Drafts to Review" and "AI Article Updates" cards, or filter the article list using the **AI Drafts** tab.`,
    },

    // Custom Domains
    {
      collectionId: sColDomain.id,
      title: 'Setting up a custom domain',
      slug: 'setting-up-custom-domain',
      excerpt: 'Serve your help center at help.yourcompany.com instead of a helpnest.cloud subdomain.',
      order: 0,
      content: `# Setting up a custom domain

You can serve your help center from your own domain, such as **help.yourcompany.com**.

> Custom domains are available on Pro and Business plans.

## Steps

1. Go to **Settings → Custom Domain**, enter your domain (e.g. \`help.yourcompany.com\`), and click **Save**.
2. In your DNS provider, add a CNAME record pointing to \`helpnest.cloud\`. DNS propagation can take up to 48 hours.
3. Once the CNAME is detected, HelpNest automatically provisions an SSL certificate. You will see the SSL status update in Settings.
4. Your help center is now live at your custom domain. The \`{slug}.helpnest.cloud\` URL continues to work as a fallback.

## DNS record reference

| Type | Name | Value |
|------|------|-------|
| CNAME | help | helpnest.cloud |`,
    },
    {
      collectionId: sColDomain.id,
      title: 'Domain verification troubleshooting',
      slug: 'domain-verification-troubleshooting',
      excerpt: 'What to do if your custom domain is not verifying.',
      order: 1,
      content: `# Domain verification troubleshooting

If your custom domain is not verifying after 24 hours, here are the most common causes.

## Check the CNAME record

Use a DNS lookup tool (dig, nslookup, or an online checker) to confirm the CNAME record is set:

\`\`\`
dig help.yourcompany.com CNAME
\`\`\`

The response should show \`helpnest.cloud\` as the target.

## Proxy or CDN in front

If you are using Cloudflare with the proxy enabled (orange cloud), turn it off (grey cloud) for the CNAME record. Proxied records cannot be verified.

## Subdomain conflicts

Make sure there is no existing A record or other DNS record conflicting with the CNAME.

## Still not working?

If you have checked all of the above and your domain is still not verifying, contact support and include your domain name and a screenshot of your DNS settings.`,
    },
  ]

  for (const article of supportArticles) {
    await prisma.article.upsert({
      where: { workspaceId_slug: { workspaceId: supportWorkspace.id, slug: article.slug } },
      update: {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        isSeeded: true,
      },
      create: {
        workspaceId: supportWorkspace.id,
        authorId: user.id,
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        views: 0,
        isSeeded: true,
        ...article,
      },
    })
  }

  console.log(`✅ Seeded ${supportArticles.length} articles into 'support' workspace`)
  console.log('   http://localhost:3000/helpnest/help → HelpNest self-host docs')
  console.log('   http://localhost:3000/support/help  → HelpNest Cloud support')
  console.log('   http://localhost:3000/dashboard     → Dashboard')
  console.log(`   Login: ${adminEmail} / ${adminPassword}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
