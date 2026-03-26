import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { checkAiCredits } from '@/lib/ai-credits'

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credits = await checkAiCredits(auth.workspaceId)
  return NextResponse.json({
    used: credits.used,
    limit: credits.limit,
    remaining: credits.remaining,
    hasOwnKey: credits.hasOwnKey,
  })
}
