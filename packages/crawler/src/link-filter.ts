import type { DiscoveredLink, FilteredLink, LinkFilterResult } from './types'

interface LinkFilterPrompt {
  system: string
  userMessage: string
}

export function buildLinkFilterPrompt(links: DiscoveredLink[], goal: string, domain: string): LinkFilterPrompt {
  const system = `You are helping build a customer help center. The user wants to create help articles about: "${goal}"

You will be given a list of pages found on ${domain}. Select ONLY the pages that would help create useful customer help articles for this goal.

Skip: login/auth pages, legal pages (terms, privacy), careers, blog posts, company "about" pages, and anything not relevant to the goal.

Respond with ONLY a JSON object:
{
  "mode": "focused" | "discovery",
  "links": [{ "url": string, "reason": string, "priority": "high" | "medium" | "low" }]
}

Use "focused" if ≤5 pages are needed, "discovery" if more. Order links by priority (high first).`

  const linkList = links.map((l, i) => `${i + 1}. ${l.url} — "${l.anchorText}"`).join('\n')
  const userMessage = `Goal: ${goal}\n\nPages found on ${domain} (${links.length} total):\n\n${linkList}`

  return { system, userMessage }
}

export function parseLinkFilterResponse(raw: string): LinkFilterResult {
  let parsed: any = null

  try { parsed = JSON.parse(raw) } catch {
    const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (match) { try { parsed = JSON.parse(match[1]) } catch {} }
  }

  if (!parsed || !Array.isArray(parsed.links)) {
    return { mode: 'focused', selectedLinks: [], totalDiscovered: 0 }
  }

  const selectedLinks: FilteredLink[] = parsed.links
    .filter((l: any) => typeof l.url === 'string')
    .map((l: any) => ({
      url: l.url,
      anchorText: typeof l.anchorText === 'string' ? l.anchorText : '',
      reason: typeof l.reason === 'string' ? l.reason : '',
      priority: ['high', 'medium', 'low'].includes(l.priority) ? l.priority : 'medium',
    }))

  const mode = selectedLinks.length > 5 ? 'discovery' : (parsed.mode === 'discovery' ? 'discovery' : 'focused')

  return { mode, selectedLinks, totalDiscovered: selectedLinks.length }
}
