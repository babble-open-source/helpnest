/**
 * Demo seed for the K1+K2 ticketing UI flow walkthrough.
 * Creates an isolated demo workspace + a credentials login + rich ticket data
 * (orgs, contacts, conversations across every status, assignment, internal notes,
 * and one anonymous conversation for the "Link contact" empty state).
 *
 * Run: cd apps/web && DATABASE_URL=postgresql://helpnest:helpnest@localhost:5432/helpnest_dev \
 *        npx tsx scripts/demo-seed.ts
 *
 * Idempotent: wipes and reseeds the 'demo-tickets' workspace each run.
 * NOT part of the product — a local dev convenience only.
 *
 * DEV-ONLY: must NEVER be run against a production database. It deletes the
 * 'demo-tickets' workspace (cascading all its data) and upserts a demo login
 * with a known password.
 */
import { PrismaClient } from '@helpnest/db'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('Set DATABASE_URL')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const SLUG = 'demo-tickets'
const EMAIL = 'demo@helpnest.test'
const PASSWORD = 'demo1234'

async function main() {
  // Clean slate for re-runs
  const existing = await prisma.workspace.findUnique({ where: { slug: SLUG } })
  if (existing) {
    await prisma.workspace.delete({ where: { id: existing.id } }) // cascades conversations/contacts/orgs
  }

  const passwordHash = bcrypt.hashSync(PASSWORD, 10)
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, name: 'Demo Agent' },
    create: { email: EMAIL, name: 'Demo Agent', passwordHash },
  })

  const ws = await prisma.workspace.create({
    data: { name: 'Demo Support', slug: SLUG, aiEnabled: true },
  })
  const member = await prisma.member.create({
    data: { workspaceId: ws.id, userId: user.id, role: 'OWNER' },
  })
  await prisma.workspaceCounter.create({
    data: { workspaceId: ws.id, lastConversationNumber: 0 },
  })

  // Organizations (B2B accounts)
  const acme = await prisma.organization.create({
    data: {
      workspaceId: ws.id,
      name: 'Acme Corp',
      domains: ['acme.test'],
      plan: 'Business',
      ownerId: member.id,
      tags: ['enterprise'],
    },
  })
  const globex = await prisma.organization.create({
    data: {
      workspaceId: ws.id,
      name: 'Globex Inc',
      domains: ['globex.test'],
      plan: 'Pro',
      ownerId: member.id,
      tags: ['growth'],
    },
  })

  // Contacts linked to orgs
  async function contact(email: string, fullName: string, org: { id: string }, phone?: string) {
    const c = await prisma.contact.create({
      data: { workspaceId: ws.id, email, fullName, phone: phone ?? null },
    })
    await prisma.contactOrganization.create({
      data: {
        workspaceId: ws.id,
        contactId: c.id,
        organizationId: org.id,
        isPrimary: true,
        role: 'MEMBER',
        source: 'DOMAIN',
      },
    })
    return c
  }
  const sarah = await contact('sarah@acme.test', 'Sarah Lin', acme, '+1 415 555 0142')
  const mia = await contact('mia@acme.test', 'Mia Torres', acme)
  const tom = await contact('tom@globex.test', 'Tom Becker', globex)
  const dev = await contact('dev@globex.test', 'Priya Nair', globex)

  let n = 0
  async function nextNumber() {
    n += 1
    return n
  }

  type Msg = {
    role: 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM'
    content: string
    isInternal?: boolean
    confidence?: number
  }
  async function ticket(opts: {
    status: 'ESCALATED' | 'ACTIVE' | 'HUMAN_ACTIVE' | 'RESOLVED_AI' | 'RESOLVED_HUMAN'
    subject: string
    contact?: { id: string; email: string; fullName: string }
    org?: { id: string }
    assigned?: boolean
    aiConfidence?: number
    escalationReason?: string
    resolutionSummary?: string
    anonymous?: { customerName: string; customerEmail?: string; visitorId?: string }
    messages: Msg[]
  }) {
    const number = await nextNumber()
    const conv = await prisma.conversation.create({
      data: {
        workspaceId: ws.id,
        number,
        status: opts.status,
        subject: opts.subject,
        contactId: opts.contact?.id ?? null,
        organizationId: opts.org?.id ?? null,
        assignedToId: opts.assigned ? member.id : null,
        aiConfidence: opts.aiConfidence ?? null,
        escalationReason: opts.escalationReason ?? null,
        resolutionSummary: opts.resolutionSummary ?? null,
        customerName: opts.contact?.fullName ?? opts.anonymous?.customerName ?? null,
        customerEmail: opts.contact?.email ?? opts.anonymous?.customerEmail ?? null,
        visitorId: opts.anonymous?.visitorId ?? null,
      },
    })
    await prisma.workspaceCounter.update({
      where: { workspaceId: ws.id },
      data: { lastConversationNumber: number },
    })
    // Stagger createdAt per message — the inbox sorts by createdAt asc, and
    // rapid sequential inserts can collide at millisecond precision.
    const baseTime = Date.now() - opts.messages.length * 60_000
    let i = 0
    for (const m of opts.messages) {
      i += 1
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: m.role,
          content: m.content,
          isInternal: m.isInternal ?? false,
          authorMemberId: m.role === 'AGENT' ? member.id : null,
          confidence: m.confidence ?? null,
          createdAt: new Date(baseTime + i * 60_000),
        },
      })
    }
    await prisma.conversationEvent.create({
      data: {
        workspaceId: ws.id,
        conversationId: conv.id,
        actorType: 'CUSTOMER',
        actorLabel: opts.contact?.fullName ?? 'Customer',
        verb: 'CONVERSATION_CREATED',
      },
    })
    if (opts.contact) {
      await prisma.conversationEvent.create({
        data: {
          workspaceId: ws.id,
          conversationId: conv.id,
          actorType: 'SYSTEM',
          actorLabel: 'System',
          verb: 'CONTACT_LINKED',
          payload: { contactId: opts.contact.id },
        },
      })
    }
    if (opts.assigned) {
      await prisma.conversationEvent.create({
        data: {
          workspaceId: ws.id,
          conversationId: conv.id,
          actorType: 'AGENT',
          actorMemberId: member.id,
          actorLabel: 'Demo Agent',
          verb: 'ASSIGNED',
          payload: { toMemberId: member.id },
        },
      })
    }
    return conv
  }

  await ticket({
    status: 'ESCALATED',
    subject: 'Cannot export invoices to CSV',
    contact: sarah,
    org: acme,
    assigned: true,
    aiConfidence: 0.24,
    escalationReason: 'Low confidence on a billing/export edge case',
    messages: [
      {
        role: 'CUSTOMER',
        content:
          'When I click Export on the Invoices page nothing downloads. We need the Q2 CSV for our auditor today.',
      },
      {
        role: 'AI',
        content:
          'I can help with invoice exports. Could you tell me which browser you are using and whether you see any error message?',
        confidence: 0.24,
      },
      { role: 'SYSTEM', content: 'AI confidence below threshold — escalated to a human agent.' },
      {
        role: 'AGENT',
        content:
          'Hi Sarah, sorry about that! This is a known issue with Safari pop-up blocking. Try Chrome, or allow downloads for our domain — the CSV should appear immediately.',
      },
      {
        role: 'AGENT',
        isInternal: true,
        content:
          'Internal: confirmed Safari download bug — eng ticket HN-4821. Tell enterprise accounts to use Chrome until the fix ships next sprint.',
      },
    ],
  })

  await ticket({
    status: 'HUMAN_ACTIVE',
    subject: 'Refund for duplicate charge',
    contact: mia,
    org: acme,
    assigned: true,
    messages: [
      {
        role: 'CUSTOMER',
        content:
          'We were charged twice for the Business plan this month. Please refund the duplicate.',
      },
      {
        role: 'AI',
        content:
          'I see two charges on your account this cycle. A human agent will confirm and process the refund.',
        confidence: 0.55,
      },
      {
        role: 'AGENT',
        content:
          'Hi Mia — confirmed the duplicate charge. I have issued a refund; it will appear in 3–5 business days.',
      },
      {
        role: 'AGENT',
        isInternal: true,
        content:
          'Internal: refund approved by finance (ref RF-2210). Root cause = retry on a timed-out Stripe webhook.',
      },
    ],
  })

  await ticket({
    status: 'ACTIVE',
    subject: 'How do I add teammates?',
    contact: tom,
    org: globex,
    aiConfidence: 0.92,
    messages: [
      { role: 'CUSTOMER', content: 'How do I invite my teammates to our workspace?' },
      {
        role: 'AI',
        content:
          'Go to Settings → Members → Invite, enter their email, and pick a role (Admin, Editor, or Viewer). They will get an email invite.',
        confidence: 0.92,
      },
    ],
  })

  await ticket({
    status: 'RESOLVED_AI',
    subject: 'Reset my password',
    contact: dev,
    org: globex,
    resolutionSummary: 'AI guided the customer through the password reset link.',
    messages: [
      { role: 'CUSTOMER', content: 'I forgot my password and cannot log in.' },
      {
        role: 'AI',
        content:
          'No problem — click "Forgot password" on the login page and follow the reset link sent to your email. Resolved?',
        confidence: 0.95,
      },
      { role: 'CUSTOMER', content: 'That worked, thanks!' },
    ],
  })

  await ticket({
    status: 'RESOLVED_HUMAN',
    subject: 'Custom domain SSL not provisioning',
    contact: sarah,
    org: acme,
    assigned: true,
    resolutionSummary: 'DNS CNAME corrected; SSL issued.',
    messages: [
      { role: 'CUSTOMER', content: 'Our custom help-center domain shows an SSL warning.' },
      {
        role: 'AGENT',
        content:
          'Your CNAME was pointing to the wrong target. I corrected it and the certificate has been issued — please re-check.',
      },
      { role: 'CUSTOMER', content: 'Looks good now. Thank you!' },
    ],
  })

  // Anonymous conversation — demonstrates the "No contact linked / Link contact" empty state
  await ticket({
    status: 'ACTIVE',
    subject: 'Pricing for 50 seats?',
    anonymous: { customerName: 'Website visitor', visitorId: 'visitor-demo-001' },
    aiConfidence: 0.7,
    messages: [
      { role: 'CUSTOMER', content: 'What would the Business plan cost for about 50 agents?' },
      {
        role: 'AI',
        content:
          'The Business plan is usage-based above 50 members — I can connect you with sales for an exact quote.',
        confidence: 0.7,
      },
    ],
  })

  console.log('Demo seeded.')
  console.log(
    JSON.stringify(
      { workspaceSlug: SLUG, login: { email: EMAIL, password: PASSWORD }, tickets: n },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
