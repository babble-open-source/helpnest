# v0.2.0 — AI-First Customer Support

This release marks a significant evolution for HelpNest. What started as an open-source knowledge base is now a full **AI-first customer support platform** — bringing together a knowledge base, conversational AI, and a human escalation inbox in a single self-hostable package.

AI answers instantly. Your team handles what matters most.

---

## What's New

### AI Agent

The core of this release. An AI agent works alongside your support team — handling routine customer questions using your knowledge base, so your team can focus on the conversations that need them most.

- **Conversational AI** — multi-turn chat, not single-shot Q&A. The agent remembers context across the conversation.
- **Tool-use** — the agent actively searches your articles, asks clarifying questions, and decides when to escalate — all without human intervention.
- **Confidence scoring** — the agent assesses how confident it is in each answer. Below your configured threshold, it automatically escalates to a human.
- **Source attribution** — every answer cites the KB articles used, so customers can read more.
- **Bring your own model** — configure any provider from the dashboard: **Anthropic (Claude)**, **OpenAI (GPT)**, **Google (Gemini)**, or **Mistral**. Use your own API keys. No lock-in.

### Escalation Inbox

A lightweight inbox for your team — only receives conversations the AI couldn't resolve.

- Full conversation history with role indicators (customer / AI / agent)
- AI confidence score and escalation reason visible per conversation
- Assign conversations to teammates
- Agent replies are picked up instantly by the customer's widget
- Real-time badge + toast notification when new escalations arrive

### Knowledge Gap Tracking

The agent knows what it doesn't know. When it can't answer confidently, it logs the question as a knowledge gap.

- **Knowledge Gaps dashboard** — unanswered questions ranked by how often they're asked
- **One-click article creation** — pre-fills the editor with the gap question as the title
- **Resolution tracking** — mark a gap resolved when you publish a covering article
- Over time, your KB improves automatically based on real customer questions

### Conversational Widget

The embeddable widget has been upgraded from a search panel to a full chat interface.

- Chat bubbles, typing indicator, streaming AI responses
- Source chips below each AI answer (clickable, open the article)
- "Talk to a human" button — instant escalation from the widget
- Session persistence — customers resume their conversation when they reopen the widget
- Backwards compatible: `data-mode="search"` keeps the legacy search-only behavior

### Multi-Provider AI Architecture

HelpNest uses its own provider abstraction — no dependency on any AI framework. Each provider is a small adapter (~60 lines) wrapping the respective SDK.

```
Anthropic (Claude)  →  @anthropic-ai/sdk
OpenAI (GPT)        →  openai
Google (Gemini)     →  @google/generative-ai
Mistral             →  @mistralai/client
```

Switching providers requires no code changes — just update **Dashboard → Settings → AI Agent**.

### SDK v0.1.0

`@helpnest/sdk` now includes full conversation support:

```typescript
// Conversations
await client.conversations.list({ status: 'ESCALATED' })
await client.conversations.get(id)
await client.conversations.updateStatus(id, 'RESOLVED_HUMAN', 'Fixed billing issue.')

// Messages
await client.messages.list(conversationId)
await client.messages.send(conversationId, { content: 'Here is how to fix that…' })
```

### Slack Bot Update

`helpnest-slack` now uses the AI agent for `/helpnest-ask` — it sends the question to the AI agent and returns a full answer with cited sources, rather than just a list of links. If the question needs human attention, the response includes a direct link to the HelpNest inbox.

---

## Upgrading from v0.1.x

```bash
git pull origin main
pnpm install
pnpm db:migrate     # adds Conversation, Message, KnowledgeGap tables
pnpm db:generate    # regenerate Prisma client
pnpm build
```

After upgrading, enable the AI agent from your dashboard:

**Dashboard → Settings → AI Agent → Enable → choose provider + model + API key → Save**

The widget defaults to chat mode after upgrade. To keep the legacy search-only widget, add `data-mode="search"` to your script tag.

---

## New Environment Variables

No new required environment variables. AI provider API keys are configured per-workspace in the dashboard.

For vector search (if not already set):

```env
OPENAI_API_KEY=sk-...         # article embeddings
QDRANT_URL=http://localhost:6333
```

---

## What's Next

- **Email channel** — support tickets via email → AI answers → inbox
- **Webhooks** — notify external systems (Slack, PagerDuty, Zapier) on escalation
- **CSAT** — customer satisfaction scores after resolution
- **CLI** — `npx helpnest` for setup, export, and import

---

## Contributors

Thank you to everyone who contributed issues, PRs, and feedback that shaped this release.

If you find HelpNest useful, please ⭐ the repo — it helps others find the project.
