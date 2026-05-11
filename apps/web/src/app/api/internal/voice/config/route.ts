import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateInternalSecret } from '@/lib/voice/internal-auth'

export async function GET(request: Request) {
  const authError = validateInternalSecret(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      slug: true,
      aiProvider: true,
      aiModel: true,
      aiApiKey: true,
      aiInstructions: true,
      aiGreeting: true,
      aiEscalationThreshold: true,
      productContext: true,
    },
  })

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  let decryptedKey: string | null = null
  if (workspace.aiApiKey) {
    const { decryptApiKey } = await import('@/lib/ai/resolve-provider')
    decryptedKey = decryptApiKey(workspace.aiApiKey)
  } else {
    const provider = (workspace.aiProvider ?? 'ANTHROPIC').toUpperCase()
    const envMap: Record<string, string> = {
      ANTHROPIC: 'ANTHROPIC_API_KEY',
      OPENAI: 'OPENAI_API_KEY',
      GOOGLE: 'GOOGLE_AI_API_KEY',
      MISTRAL: 'MISTRAL_API_KEY',
    }
    decryptedKey = process.env[envMap[provider] ?? 'ANTHROPIC_API_KEY'] ?? null
  }

  return NextResponse.json({
    aiProvider: workspace.aiProvider ?? 'ANTHROPIC',
    aiModel: workspace.aiModel,
    aiApiKey: decryptedKey,
    aiInstructions: workspace.aiInstructions,
    aiGreeting: workspace.aiGreeting ?? 'Hi! How can I help you today?',
    escalationThreshold: workspace.aiEscalationThreshold ?? 0.3,
    productContext: workspace.productContext,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
  })
}
