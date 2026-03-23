const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4'

function getKVConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !namespaceId || !apiToken) return null
  return { accountId, namespaceId, apiToken }
}

export async function kvPutDomain(domain: string, slug: string): Promise<void> {
  const config = getKVConfig()
  if (!config) return
  try {
    const res = await fetch(
      `${CLOUDFLARE_API}/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(domain)}`,
      { method: 'PUT', headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'text/plain' }, body: slug },
    )
    if (!res.ok) console.error(`[cloudflare-kv] PUT ${domain} failed: ${res.status}`)
  } catch (err) {
    console.error(`[cloudflare-kv] PUT ${domain} error:`, err)
  }
}

export async function kvDeleteDomain(domain: string): Promise<void> {
  const config = getKVConfig()
  if (!config) return
  try {
    const res = await fetch(
      `${CLOUDFLARE_API}/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(domain)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${config.apiToken}` } },
    )
    if (!res.ok && res.status !== 404) console.error(`[cloudflare-kv] DELETE ${domain} failed: ${res.status}`)
  } catch (err) {
    console.error(`[cloudflare-kv] DELETE ${domain} error:`, err)
  }
}
