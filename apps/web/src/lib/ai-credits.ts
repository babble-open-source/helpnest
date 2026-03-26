import { prisma } from '@/lib/db'

interface CreditCheck {
  allowed: boolean
  used: number
  limit: number
  remaining: number
  hasOwnKey: boolean
}

/**
 * Check if a workspace has AI credits remaining for article generation.
 *
 * Rules:
 * - If workspace has its own AI key configured (BYOK), credits are unlimited
 * - Otherwise, uses the server operator's key with a credit limit
 * - Default limit: 5 (free tier). Cloud plans override this via helpnest-cloud.
 * - Self-hosted operators can set any limit they want.
 */
export async function checkAiCredits(workspaceId: string): Promise<CreditCheck> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { aiCreditsUsed: true, aiCreditsLimit: true, aiApiKey: true },
  })

  if (!workspace) {
    return { allowed: false, used: 0, limit: 0, remaining: 0, hasOwnKey: false }
  }

  // BYOK (Bring Your Own Key) = unlimited credits
  if (workspace.aiApiKey) {
    return {
      allowed: true,
      used: workspace.aiCreditsUsed,
      limit: -1, // -1 = unlimited
      remaining: -1,
      hasOwnKey: true,
    }
  }

  const remaining = workspace.aiCreditsLimit - workspace.aiCreditsUsed

  return {
    allowed: remaining > 0,
    used: workspace.aiCreditsUsed,
    limit: workspace.aiCreditsLimit,
    remaining: Math.max(0, remaining),
    hasOwnKey: false,
  }
}

/**
 * Increment AI credits used for a workspace.
 * Call this after successfully generating an article.
 */
export async function incrementAiCredits(workspaceId: string, count: number = 1): Promise<void> {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { aiCreditsUsed: { increment: count } },
  })
}
