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

  // Create workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme',
      logo: null,
    },
  })

  // Add user as owner
  await prisma.member.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: MemberRole.OWNER,
    },
  })

  // Create collections
  const gettingStarted = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: 'getting-started' } },
    update: {},
    create: {
      workspaceId: workspace.id,
      title: 'Getting Started',
      description: 'Everything you need to get up and running quickly.',
      emoji: '🚀',
      slug: 'getting-started',
      order: 0,
      isPublic: true,
    },
  })

  const faq = await prisma.collection.upsert({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: 'faq' } },
    update: {},
    create: {
      workspaceId: workspace.id,
      title: 'FAQ',
      description: 'Frequently asked questions and answers.',
      emoji: '❓',
      slug: 'faq',
      order: 1,
      isPublic: true,
    },
  })

  // Create articles
  const articles = [
    {
      collectionId: gettingStarted.id,
      title: 'Welcome to Acme Corp',
      slug: 'welcome-to-acme',
      content: `# Welcome to Acme Corp\n\nWe're thrilled to have you here! This guide will help you get started with our platform.\n\n## What is Acme Corp?\n\nAcme Corp is a powerful platform that helps teams collaborate and ship faster.\n\n## Next Steps\n\n1. Set up your account\n2. Invite your team\n3. Create your first project\n\nIf you need help, don't hesitate to reach out to our support team.`,
      excerpt: 'Get started with Acme Corp in minutes.',
      status: ArticleStatus.PUBLISHED,
      order: 0,
      views: 142,
    },
    {
      collectionId: gettingStarted.id,
      title: 'Quick Start Guide',
      slug: 'quick-start',
      content: `# Quick Start Guide\n\nFollow these steps to get up and running in under 5 minutes.\n\n## Step 1: Create an Account\n\nHead to our signup page and create your free account.\n\n## Step 2: Set Up Your Workspace\n\nCustomize your workspace settings including name, logo, and team members.\n\n## Step 3: Import Your Data\n\nImport existing data or start fresh with our templates.`,
      excerpt: 'Up and running in under 5 minutes.',
      status: ArticleStatus.PUBLISHED,
      order: 1,
      views: 89,
    },
    {
      collectionId: gettingStarted.id,
      title: 'Inviting Your Team',
      slug: 'inviting-team',
      content: `# Inviting Your Team\n\nCollaboration is at the heart of Acme Corp. Here's how to bring your team on board.\n\n## Sending Invitations\n\nGo to Settings > Team Members and click "Invite Members".\n\n## Managing Roles\n\n- **Owner**: Full access, billing management\n- **Admin**: Full access except billing\n- **Editor**: Can create and edit content\n- **Viewer**: Read-only access`,
      excerpt: 'Bring your whole team on board.',
      status: ArticleStatus.PUBLISHED,
      order: 2,
      views: 67,
    },
    {
      collectionId: faq.id,
      title: 'How do I reset my password?',
      slug: 'reset-password',
      content: `# How do I reset my password?\n\nForgetting passwords happens to everyone. Here's how to reset yours.\n\n## Steps\n\n1. Go to the login page\n2. Click "Forgot Password"\n3. Enter your email address\n4. Check your email for a reset link\n5. Follow the link to create a new password\n\n## Didn't receive the email?\n\nCheck your spam folder. If it's not there, contact support.`,
      excerpt: 'Simple steps to reset your account password.',
      status: ArticleStatus.PUBLISHED,
      order: 0,
      views: 203,
    },
    {
      collectionId: faq.id,
      title: 'What payment methods do you accept?',
      slug: 'payment-methods',
      content: `# What payment methods do you accept?\n\nWe accept a variety of payment methods to make it easy for you.\n\n## Accepted Methods\n\n- Credit cards (Visa, Mastercard, American Express)\n- Debit cards\n- PayPal\n- Bank transfers (enterprise plans)\n\n## Billing Cycle\n\nAll plans are billed monthly or annually. Annual billing saves you 20%.`,
      excerpt: 'We accept all major credit cards and PayPal.',
      status: ArticleStatus.PUBLISHED,
      order: 1,
      views: 156,
    },
  ]

  for (const article of articles) {
    await prisma.article.upsert({
      where: { workspaceId_slug: { workspaceId: workspace.id, slug: article.slug } },
      update: {},
      create: {
        workspaceId: workspace.id,
        authorId: user.id,
        publishedAt: new Date(),
        ...article,
      },
    })
  }

  console.log('✅ Seed complete!')
  console.log(`   Workspace: ${workspace.name} (slug: ${workspace.slug})`)
  console.log(`   Collections: 2`)
  console.log(`   Articles: ${articles.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
