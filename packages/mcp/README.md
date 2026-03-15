# @helpnest/mcp

MCP (Model Context Protocol) server for HelpNest. Exposes your knowledge base as tools for AI assistants like Claude Desktop, Cursor, and coding agents.

## Installation

```bash
npm install -g @helpnest/mcp
# or run directly
npx @helpnest/mcp
```

## Configuration

The server reads configuration from environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `HELPNEST_API_KEY` | Yes | Your HelpNest API key (e.g., `hn_live_xxx`) |
| `HELPNEST_WORKSPACE` | Yes | Workspace slug (e.g., `acme`) |
| `HELPNEST_BASE_URL` | No | HelpNest instance URL (defaults to `https://helpnest.cloud`) |

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "helpnest": {
      "command": "npx",
      "args": ["@helpnest/mcp"],
      "env": {
        "HELPNEST_API_KEY": "hn_live_xxx",
        "HELPNEST_WORKSPACE": "acme",
        "HELPNEST_BASE_URL": "https://help.acme.com"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "helpnest": {
      "command": "npx",
      "args": ["@helpnest/mcp"],
      "env": {
        "HELPNEST_API_KEY": "hn_live_xxx",
        "HELPNEST_WORKSPACE": "acme",
        "HELPNEST_BASE_URL": "https://help.acme.com"
      }
    }
  }
}
```

## Tools

| Tool | Input | Description |
|------|-------|-------------|
| `search_articles` | `{ query: string }` | Search help articles by keyword. Returns titles, slugs, and snippets. |
| `get_article` | `{ slug_or_id: string }` | Get full content of a specific article by slug or ID. |
| `list_collections` | none | List all collections (categories) with descriptions. |
| `ask_question` | `{ question: string }` | Search for relevant articles and return their full content (top 3 matches). |

## Architecture

The MCP server is a thin protocol wrapper around the `@helpnest/sdk`. It communicates with your HelpNest instance over HTTP using your API key — no direct database access. This means it works with both self-hosted and cloud instances.

```
AI Assistant (Claude, Cursor, etc.)
    │ stdio (MCP protocol)
    ▼
@helpnest/mcp
    │ HTTP (REST API)
    ▼
HelpNest instance
```

## Build

```bash
pnpm build      # compiles with tsup (CJS + ESM)
pnpm typecheck  # type-check without emitting
```

Built with `tsup` producing dual CJS and ESM output with a `#!/usr/bin/env node` shebang for CLI usage.
