import { PrismaClient, ArticleStatus, MemberRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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

  const colAbout = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: docsWorkspace.id, slug: 'about' } },
    update: {},
    create: { workspaceId: docsWorkspace.id, title: 'About', description: 'The story behind HelpNest — why it was built and who built it.', emoji: '💡', slug: 'about', order: 4, isPublic: true },
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

So I did a quick scan of how other companies handle this. Every company I respected had a clean, searchable help center. The pattern was clear. What surprised me was the cost — many of these tools charge per seat, per page view, or lock key features behind expensive tiers. For an early-stage product that just needs a solid place to answer customer questions, the pricing felt out of proportion.

I searched for open source alternatives. There are several great developer documentation frameworks — Docusaurus, Mintlify, ReadMe — but they are built *for developers, by developers*. I could not find a single stable, well-maintained OSS tool focused on the general customer audience.

That gap is why HelpNest exists. A clean, self-hostable help center that your customers — not just your engineers — can actually use. MIT licensed, free forever, built for the world.`,
    },
    {
      collectionId: colAbout.id,
      title: 'Built with gratitude — Claude Code, Anthropic & Next.js',
      slug: 'built-with-gratitude',
      excerpt: 'A thank you to the tools and communities that made HelpNest possible.',
      order: 1,
      content: `# Built with gratitude

HelpNest was designed and built in close collaboration with **Claude Code** by Anthropic. From the monorepo architecture and database schema to API routes, UI components, and debugging edge cases — Claude was a thoughtful pair programmer throughout.

What stood out wasn't just speed, but quality of reasoning: catching security issues early, considering trade-offs, and pushing back when a simpler approach existed. Anthropic's commitment to building AI that is honest and genuinely helpful shows in every interaction.

**Next.js** by Vercel is the foundation HelpNest runs on. The App Router, Server Components, and seamless server/client rendering made it possible to ship a fast, themeable, SEO-friendly help center without sacrificing developer experience.

HelpNest also stands on the shoulders of **Tiptap**, **Prisma**, **Tailwind CSS**, **NextAuth.js**, and **Qdrant** — and the countless open source contributors behind them. Thank you.`,
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
      content: `<p>HelpNest ships with 8 built-in themes from the <code>@helpnest/themes</code> package.</p><h2>Changing the theme</h2><ol><li><p>Go to Dashboard &gt; Settings</p></li><li><p>Browse the theme gallery under <strong>Help Center Theme</strong></p></li><li><p>Click a theme to select it</p></li><li><p>Click <strong>Apply theme</strong></p></li></ol><p>The theme is applied instantly — no redeploy needed.</p><h2>Available themes</h2><ul><li><p><strong>Default</strong> — Warm cream with Instrument Serif</p></li><li><p><strong>Dark</strong> — Inverted warm tones</p></li><li><p><strong>Ocean</strong> — Clean blues, corporate feel</p></li><li><p><strong>Forest</strong> — Deep earthy greens with Lora</p></li><li><p><strong>Aurora</strong> — Violet with Syne</p></li><li><p><strong>Slate</strong> — Neutral grays, enterprise</p></li><li><p><strong>Rose</strong> — Soft pinks with Playfair Display</p></li><li><p><strong>Midnight</strong> — Deep navy, developer-focused</p></li></ul><h2>Community themes</h2><p>Additional themes are available from the <code>@helpnest/themes</code> npm package. See the helpnest-themes repository for contribution guidelines.</p>`,
    },

    // Integrations
    {
      collectionId: colIntegrations.id,
      title: 'Embeddable Widget',
      slug: 'widget',
      excerpt: 'Embed a help widget on any website with a single script tag.',
      order: 0,
      content: `<p>The HelpNest widget lets your customers search your help center from any page on your site.</p><h2>Installation</h2><p>Add the following snippet before the closing <code>&lt;/body&gt;</code> tag on your website:</p><pre><code class="language-html">&lt;script&gt;
  window.HelpNest = { workspace: 'your-workspace-slug' };
&lt;/script&gt;
&lt;script src="https://cdn.helpnest.cloud/widget.js" async&gt;&lt;/script&gt;</code></pre><p>Replace <code>your-workspace-slug</code> with your workspace slug from Settings.</p><h2>Self-hosted</h2><p>Point the script src at your own instance:</p><pre><code class="language-html">&lt;script src="https://your-domain.com/widget.js" async&gt;&lt;/script&gt;</code></pre><blockquote><p>The widget package is currently in development (Phase 3 of the roadmap).</p></blockquote>`,
    },
    {
      collectionId: colIntegrations.id,
      title: 'REST API',
      slug: 'rest-api',
      excerpt: 'Access your help center content programmatically via the REST API.',
      order: 1,
      content: `<p>HelpNest exposes a REST API for reading and managing help center content programmatically.</p><h2>Authentication</h2><p>Pass your API key in the Authorization header:</p><pre><code class="language-bash">Authorization: Bearer hn_your_api_key</code></pre><h2>Articles</h2><ul><li><p><code>GET /api/articles</code> — list published articles</p></li><li><p><code>GET /api/articles/:id</code> — get a single article</p></li><li><p><code>PATCH /api/articles/:id</code> — update an article</p></li><li><p><code>DELETE /api/articles/:id</code> — delete an article</p></li></ul><h2>Collections</h2><ul><li><p><code>GET /api/collections</code> — list collections</p></li><li><p><code>POST /api/collections</code> — create a collection</p></li><li><p><code>PATCH /api/collections/:id</code> — update a collection</p></li><li><p><code>DELETE /api/collections/:id</code> — delete a collection</p></li></ul><blockquote><p>API key management UI and full SDK are coming in Phase 3.</p></blockquote>`,
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
    create: { workspaceId: supportWorkspace.id, title: 'Account & Team', description: 'Managing your HelpNest Cloud account, workspaces, and team members.', emoji: '👤', slug: 'account', order: 0, isPublic: true },
  })

  const sColBilling = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: supportWorkspace.id, slug: 'billing' } },
    update: {},
    create: { workspaceId: supportWorkspace.id, title: 'Billing & Plans', description: 'Subscriptions, invoices, and plan limits.', emoji: '💳', slug: 'billing', order: 1, isPublic: true },
  })

  const sColSetup = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: supportWorkspace.id, slug: 'setup' } },
    update: {},
    create: { workspaceId: supportWorkspace.id, title: 'Getting Set Up', description: 'First steps after signing up for HelpNest Cloud.', emoji: '🚀', slug: 'setup', order: 2, isPublic: true },
  })

  const sColDomain = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: supportWorkspace.id, slug: 'custom-domain' } },
    update: {},
    create: { workspaceId: supportWorkspace.id, title: 'Custom Domains', description: 'Serve your help center on your own domain.', emoji: '🌐', slug: 'custom-domain', order: 3, isPublic: true },
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

HelpNest Cloud comes with 8 built-in themes. You can switch themes instantly from the dashboard.

## How to change your theme

1. Go to **Settings → Help Center Theme**
2. Browse the available themes
3. Click a theme card to preview it
4. Click **Apply theme**

The theme is applied immediately — no downtime, no redeploy.

## Available themes

- **Default** — Warm cream with Instrument Serif (what you see here)
- **Dark** — Inverted warm tones for a dark-mode feel
- **Ocean** — Clean blues, corporate feel
- **Forest** — Deep earthy greens
- **Aurora** — Violet with Syne
- **Slate** — Neutral grays, enterprise look
- **Rose** — Soft pinks with Playfair Display
- **Midnight** — Deep navy

More themes are available in the community theme marketplace.`,
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
      },
      create: {
        workspaceId: supportWorkspace.id,
        authorId: user.id,
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        views: 0,
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
