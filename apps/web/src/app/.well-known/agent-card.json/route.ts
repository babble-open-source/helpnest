/**
 * Agent Card route — serves A2A protocol metadata at the well-known URL.
 *
 * The Agent Card is a JSON document that describes this agent's capabilities,
 * skills, and endpoint to any A2A-compatible client or orchestrator. It follows
 * Google's Agent-to-Agent (A2A) protocol specification v0.2.0.
 *
 * This route is intentionally unauthenticated — discovery must be public so
 * external agents can locate and interrogate the server before presenting
 * credentials. Cache-Control is set to 1 hour since the card rarely changes.
 */

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET() {
  const agentCard = {
    name: 'HelpNest Knowledge Base',
    description:
      'AI-powered knowledge base with semantic search and RAG answers',
    version: '1.0.0',
    url: `${APP_URL}/api/a2a`,
    protocol_version: '0.2.0',
    default_input_modes: ['text/plain'],
    default_output_modes: ['text/plain', 'text/markdown'],
    capabilities: {
      streaming: true,
      pushNotifications: false,
    },
    skills: [
      {
        id: 'search',
        name: 'Search Knowledge Base',
        description:
          'Full-text and semantic search across help articles',
        tags: ['search', 'articles', 'faq'],
        examples: ['How do I reset my password?', 'Billing questions'],
        inputModes: ['text/plain'],
        outputModes: ['application/json'],
      },
      {
        id: 'ai_answer',
        name: 'AI-Powered Answer',
        description:
          'Generate an answer using RAG — searches articles, then synthesizes a response with sources',
        tags: ['ai', 'answer', 'rag', 'support'],
        examples: ['How do I change my subscription plan?'],
        inputModes: ['text/plain'],
        outputModes: ['text/markdown'],
      },
      {
        id: 'get_article',
        name: 'Get Article',
        description: 'Retrieve a specific article by slug or ID',
        tags: ['article', 'content'],
        inputModes: ['application/json'],
        outputModes: ['text/markdown'],
      },
    ],
  }

  return new Response(JSON.stringify(agentCard, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
