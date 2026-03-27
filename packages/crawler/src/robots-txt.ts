interface RobotsTxtResult {
  isAllowed: (url: string) => boolean
  disallowedPaths: string[]
}

interface Rule {
  path: string
  allow: boolean
}

export function parseRobotsTxt(content: string): RobotsTxtResult {
  if (!content.trim()) return { isAllowed: () => true, disallowedPaths: [] }

  const lines = content.split('\n').map((l) => l.trim())
  const agentRules = new Map<string, Rule[]>()
  let currentAgents: string[] = []

  for (const line of lines) {
    if (line.startsWith('#') || !line) { currentAgents = []; continue }
    const [directive, ...valueParts] = line.split(':')
    const value = valueParts.join(':').trim()
    const dir = directive.toLowerCase()

    if (dir === 'user-agent') {
      currentAgents.push(value.toLowerCase())
    } else if (dir === 'disallow' && value) {
      for (const agent of currentAgents) {
        if (!agentRules.has(agent)) agentRules.set(agent, [])
        agentRules.get(agent)!.push({ path: value, allow: false })
      }
    } else if (dir === 'allow' && value) {
      for (const agent of currentAgents) {
        if (!agentRules.has(agent)) agentRules.set(agent, [])
        agentRules.get(agent)!.push({ path: value, allow: true })
      }
    }
  }

  const rules = agentRules.get('helpnestbot') ?? agentRules.get('*') ?? []
  const sortedRules = [...rules].sort((a, b) => {
    if (b.path.length !== a.path.length) return b.path.length - a.path.length
    return a.allow ? -1 : 1
  })

  const disallowedPaths = rules.filter((r) => !r.allow).map((r) => r.path)

  function isAllowed(url: string): boolean {
    let pathname: string
    try { pathname = new URL(url).pathname } catch { return true }
    for (const rule of sortedRules) {
      if (pathname.startsWith(rule.path)) return rule.allow
    }
    return true
  }

  return { isAllowed, disallowedPaths }
}

export async function fetchRobotsTxt(baseUrl: string): Promise<string> {
  try {
    const origin = new URL(baseUrl).origin
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return ''
    return await res.text()
  } catch { return '' }
}
