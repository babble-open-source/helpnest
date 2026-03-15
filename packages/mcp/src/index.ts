import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { HelpNest } from '@helpnest/sdk'
import { getToolDefinitions, handleToolCall } from './tools'

// ── Config validation ─────────────────────────────────────────────────────────

const HELPNEST_API_KEY = process.env.HELPNEST_API_KEY
const HELPNEST_WORKSPACE = process.env.HELPNEST_WORKSPACE
const HELPNEST_BASE_URL = process.env.HELPNEST_BASE_URL

if (!HELPNEST_API_KEY || !HELPNEST_WORKSPACE) {
  console.error(
    '[helpnest-mcp] Missing required environment variables: HELPNEST_API_KEY, HELPNEST_WORKSPACE\n' +
      '\n' +
      'Set them in your MCP client config, for example:\n' +
      '  HELPNEST_API_KEY=hn_live_xxxxxxxxxxxx\n' +
      '  HELPNEST_WORKSPACE=acme\n' +
      '  HELPNEST_BASE_URL=https://help.acme.com  (optional, defaults to helpnest.cloud)',
  )
  process.exit(1)
}

// ── SDK client ────────────────────────────────────────────────────────────────

const client = new HelpNest({
  apiKey: HELPNEST_API_KEY,
  workspace: HELPNEST_WORKSPACE,
  // baseUrl is optional: omitting it uses the SDK default (helpnest.cloud)
  ...(HELPNEST_BASE_URL ? { baseUrl: HELPNEST_BASE_URL } : {}),
})

// ── MCP server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'helpnest', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: getToolDefinitions(),
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return handleToolCall(
    client,
    request.params.name,
    // MCP spec: arguments is optional; default to empty object when absent
    request.params.arguments ?? {},
  )
})

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Intentionally no console.log here — stdout is owned by the MCP protocol.
  // Any startup diagnostics must go to stderr.
  console.error('[helpnest-mcp] Server started. Workspace:', HELPNEST_WORKSPACE)
}

main().catch((err) => {
  console.error('[helpnest-mcp] Fatal: failed to start server:', err)
  process.exit(1)
})
