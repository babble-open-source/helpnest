# @helpnest/widget

Lightweight embeddable browser widget that adds a help chat panel to any website. Built as a self-contained IIFE bundle — no React or other framework required on the host page.

## Overview

The widget is distributed as `dist/widget.js` and built with esbuild. It supports two modes: an AI-powered chat interface and a real-time article search interface.

## Modes

**`chat` (default)**

Creates a conversation, streams AI responses via SSE, and handles escalation to human agents. Session state is persisted in `localStorage`. While waiting for a human agent, the widget polls every 5 seconds with a 10-minute timeout before the session expires.

**`search`**

Real-time article search with autocomplete.

## Configuration

Configuration is passed as a global object or via `data-*` attributes on the script tag.

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `workspace` | `string` | Yes | — | Workspace slug |
| `baseUrl` | `string` | Yes | — | HelpNest instance URL |
| `mode` | `'chat' \| 'search'` | No | `'chat'` | Widget mode |
| `position` | `'bottom-right' \| 'bottom-left'` | No | `'bottom-right'` | Floating button position |
| `title` | `string` | No | — | Widget header title |
| `greeting` | `string` | No | — | Opening message shown in chat |

## Installation

Embed the widget script on any page:

```html
<script
  src="https://your-helpnest-instance/widget.js"
  data-workspace="acme"
  data-base-url="https://help.acme.com"
  data-mode="chat"
  data-position="bottom-right"
  data-title="Help"
  data-greeting="Hi, how can we help?"
></script>
```

## Internal Architecture

**`HelpPanel`**

Manages the widget lifecycle: mounting the DOM panel, injecting scoped CSS, and handling open/close state.

**`ChatManager`**

Implements a state machine for the chat flow:

```
IDLE -> CHAT_AI -> CHAT_HUMAN -> RESOLVED
```

## Build

```
pnpm build    # esbuild IIFE bundle, minified output to dist/widget.js
pnpm dev      # watch mode
```

## Dependencies

| Package | Version |
|---|---|
| `esbuild` | `^0.21.0` |
| TypeScript | `^5.4` |
