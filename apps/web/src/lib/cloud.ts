/**
 * Cloud API client — calls helpnest-cloud for quota enforcement.
 *
 * When CLOUD_API_URL is not set (self-hosted mode), all checks pass
 * and increments are no-ops. This keeps the OSS app fully functional
 * without the cloud service.
 */

// Server-side only — never expose this URL to the client bundle
const CLOUD_API_URL = process.env.CLOUD_API_URL
const INTERNAL_SECRET = process.env.INTERNAL_SECRET

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (INTERNAL_SECRET) h['x-internal-secret'] = INTERNAL_SECRET
  return h
}

export type Resource =
  | 'articles'
  | 'members'
  | 'apiCalls'
  | 'aiQueries'
  | 'conversations'
  | 'messages'
  | 'aiGenerations'

export interface LimitCheckResult {
  allowed: boolean
  current: number
  limit: number
  plan: string
  reason?: string
}

/**
 * Check if a workspace is allowed to create a resource.
 * Returns `{ allowed: true }` when cloud is not configured (self-hosted).
 */
export async function checkLimit(
  workspaceId: string,
  resource: Resource,
): Promise<LimitCheckResult> {
  if (!CLOUD_API_URL) {
    return { allowed: true, current: 0, limit: Infinity, plan: 'SELF_HOSTED' }
  }

  try {
    const url = new URL('/api/limits/check', CLOUD_API_URL)
    url.searchParams.set('workspaceId', workspaceId)
    url.searchParams.set('resource', resource)

    const res = await fetch(url.toString(), {
      headers: headers(),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      console.error(`[cloud] checkLimit ${resource} failed:`, res.status)
      return { allowed: true, current: 0, limit: Infinity, plan: 'UNKNOWN' }
    }

    return (await res.json()) as LimitCheckResult
  } catch (err) {
    console.error('[cloud] checkLimit unreachable:', (err as Error).message)
    // Fail open — don't block users if cloud is down
    return { allowed: true, current: 0, limit: Infinity, plan: 'UNKNOWN' }
  }
}

/**
 * Increment usage counter after a resource is created.
 * Fire-and-forget — does not block the response.
 */
export function isCloudMode(): boolean {
  return !!CLOUD_API_URL
}

// ── Billing ──

export interface WorkspacePlan {
  plan: 'FREE' | 'PRO' | 'BUSINESS'
  status: string
  usage: {
    articles: number
    members: number
    apiCalls: number
    aiQueries: number
    conversations: number
    messages: number
    aiGenerations: number
  } | null
  limits: Record<string, number | boolean>
  stripeCustomerId?: string | null
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string | null
}

/**
 * Get workspace plan, usage, and limits from cloud.
 * Returns null in self-hosted mode.
 */
export async function getWorkspacePlan(workspaceId: string): Promise<WorkspacePlan | null> {
  if (!CLOUD_API_URL) return null

  try {
    const res = await fetch(`${CLOUD_API_URL}/api/workspaces/${workspaceId}/plan`, {
      headers: headers(),
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    return (await res.json()) as WorkspacePlan
  } catch {
    return null
  }
}

/**
 * Create a Stripe checkout session for upgrading.
 * Returns the checkout URL.
 */
export async function createCheckoutSession(
  workspaceId: string,
  plan: 'PRO' | 'BUSINESS',
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string | null> {
  if (!CLOUD_API_URL) return null

  try {
    const res = await fetch(`${CLOUD_API_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ workspaceId, planTier: plan, email, successUrl, cancelUrl }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}

/**
 * Get Stripe customer portal URL for managing subscription.
 */
export async function getPortalUrl(workspaceId: string, returnUrl?: string): Promise<string | null> {
  if (!CLOUD_API_URL) return null

  try {
    const res = await fetch(`${CLOUD_API_URL}/api/billing/portal`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ workspaceId, ...(returnUrl ? { returnUrl } : {}) }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}

/**
 * Provision a workspace in the cloud billing system.
 * Called during OSS signup when cloud mode is active.
 */
export async function provisionWorkspace(workspaceId: string): Promise<void> {
  if (!CLOUD_API_URL) return

  try {
    await fetch(`${CLOUD_API_URL}/api/workspaces/provision`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ workspaceId }),
    })
  } catch (err) {
    console.error('[cloud] provisionWorkspace failed:', (err as Error).message)
  }
}

export function incrementUsage(workspaceId: string, resource: Resource): void {
  if (!CLOUD_API_URL) return

  const url = new URL('/api/limits/increment', CLOUD_API_URL)

  fetch(url.toString(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ workspaceId, resource }),
    signal: AbortSignal.timeout(3000),
  }).catch((err) => {
    console.error('[cloud] incrementUsage failed:', (err as Error).message)
  })
}
