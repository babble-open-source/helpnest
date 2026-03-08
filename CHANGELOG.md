# Changelog

All notable changes to HelpNest will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2025-03-08

### Added

- **Help center** — Public-facing help center with collections and articles
- **Search** — Full-text search powered by PostgreSQL tsvector
- **AI answers** — RAG pipeline using OpenAI embeddings + Claude claude-haiku-4-5-20251001
- **Article editor** — Rich text editor (Tiptap) with auto-save and version history
- **Dashboard** — Admin UI for managing articles, collections, and settings
- **Embeddable widget** — Vanilla JS widget for embedding help launcher in any app
- **CLI** — `npx helpnest` with init, dev, export, import, and deploy commands
- **JS/TS SDK** — Typed client for the HelpNest REST API
- **Docker** — Production Dockerfile and docker-compose for self-hosting
- **Auth** — NextAuth v5 with email credentials and GitHub OAuth
