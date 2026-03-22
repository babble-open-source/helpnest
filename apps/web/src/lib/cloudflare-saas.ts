/**
 * Cloudflare for SaaS — custom domain management.
 *
 * Handles creating and verifying custom hostnames via the Cloudflare API.
 * Only active when CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN are set.
 *
 * Setup (one-time in Cloudflare dashboard):
 * 1. Enable Cloudflare for SaaS on your zone
 * 2. Set fallback origin to your Railway domain (e.g. dashboard.helpnest.cloud)
 * 3. Create an API token with "SSL and Certificates: Edit" permission
 */

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const FALLBACK_ORIGIN = process.env.CLOUDFLARE_FALLBACK_ORIGIN // e.g. dashboard.helpnest.cloud

const CF_API = 'https://api.cloudflare.com/client/v4'

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_TOKEN}`,
  }
}

export function isCloudflareEnabled(): boolean {
  return !!(ZONE_ID && API_TOKEN)
}

export interface CustomHostnameResult {
  id: string
  hostname: string
  status: string // pending_validation, active, moved, deleted
  verificationErrors?: string[]
  ssl: {
    status: string // initializing, pending_validation, active
    method: string
    txtName?: string
    txtValue?: string
  }
  ownershipVerification?: {
    type: string
    name: string
    value: string
  }
}

/**
 * Create a custom hostname in Cloudflare.
 * Returns the hostname record with SSL and ownership verification details.
 */
export async function createCustomHostname(
  domain: string,
): Promise<CustomHostnameResult | null> {
  if (!ZONE_ID || !API_TOKEN) return null

  try {
    const res = await fetch(`${CF_API}/zones/${ZONE_ID}/custom_hostnames`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        hostname: domain,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: {
            min_tls_version: '1.2',
          },
        },
      }),
    })

    const data = await res.json() as { success: boolean; result?: Record<string, unknown>; errors?: Array<{ message: string }> }

    if (!data.success) {
      console.error('[cloudflare] createCustomHostname failed:', data.errors)
      return null
    }

    const r = data.result as Record<string, unknown>
    return parseHostnameResult(r)
  } catch (err) {
    console.error('[cloudflare] createCustomHostname error:', (err as Error).message)
    return null
  }
}

/**
 * Get the status of a custom hostname.
 */
export async function getCustomHostnameStatus(
  hostnameId: string,
): Promise<CustomHostnameResult | null> {
  if (!ZONE_ID || !API_TOKEN) return null

  try {
    const res = await fetch(`${CF_API}/zones/${ZONE_ID}/custom_hostnames/${hostnameId}`, {
      headers: headers(),
    })

    const data = await res.json() as { success: boolean; result?: Record<string, unknown> }
    if (!data.success || !data.result) return null

    return parseHostnameResult(data.result)
  } catch {
    return null
  }
}

/**
 * Find a custom hostname by domain name.
 */
export async function findCustomHostname(
  domain: string,
): Promise<CustomHostnameResult | null> {
  if (!ZONE_ID || !API_TOKEN) return null

  try {
    const res = await fetch(`${CF_API}/zones/${ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(domain)}`, {
      headers: headers(),
    })

    const data = await res.json() as { success: boolean; result?: Array<Record<string, unknown>> }
    if (!data.success || !data.result?.length || !data.result[0]) return null

    return parseHostnameResult(data.result[0])
  } catch {
    return null
  }
}

/**
 * Delete a custom hostname from Cloudflare.
 */
export async function deleteCustomHostname(hostnameId: string): Promise<boolean> {
  if (!ZONE_ID || !API_TOKEN) return false

  try {
    const res = await fetch(`${CF_API}/zones/${ZONE_ID}/custom_hostnames/${hostnameId}`, {
      method: 'DELETE',
      headers: headers(),
    })

    const data = await res.json() as { success: boolean }
    return data.success
  } catch {
    return false
  }
}

function parseHostnameResult(r: Record<string, unknown>): CustomHostnameResult {
  const ssl = r.ssl as Record<string, unknown> | undefined
  const ownership = r.ownership_verification as Record<string, unknown> | undefined
  const validationRecords = ssl?.validation_records as Array<Record<string, string>> | undefined

  return {
    id: r.id as string,
    hostname: r.hostname as string,
    status: r.status as string,
    verificationErrors: r.verification_errors as string[] | undefined,
    ssl: {
      status: (ssl?.status as string) ?? 'unknown',
      method: (ssl?.method as string) ?? 'txt',
      txtName: validationRecords?.[0]?.txt_name,
      txtValue: validationRecords?.[0]?.txt_value,
    },
    ownershipVerification: ownership
      ? {
          type: ownership.type as string,
          name: ownership.name as string,
          value: ownership.value as string,
        }
      : undefined,
  }
}
