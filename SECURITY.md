# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.**

Report it privately, and we will work with you on a fix before any details are made
public:

- **GitHub:** [open a private security advisory](https://github.com/babble-open-source/helpnest/security/advisories/new) — preferred, as it keeps the discussion attached to the code.
- **Email:** security@helpnest.cloud

Please include enough detail to reproduce the issue: the affected version or commit,
the steps to trigger it, and what an attacker gains. A proof of concept helps, but a
clear description is more useful than a working exploit.

We aim to acknowledge a report within **3 working days** and to keep you updated as
we investigate. HelpNest is maintained by a small team, so please allow reasonable
time for a fix before disclosing publicly. We are happy to credit you in the release
notes unless you would rather stay anonymous.

We do not currently run a paid bug bounty.

## Scope

**In scope** — anything in this repository, and the hosted service at
`app.helpnest.cloud`:

- Authentication and session handling
- Workspace isolation — any way to read or write another workspace's articles,
  conversations, contacts, or settings
- Exposure of internal notes or unpublished drafts to help-center visitors or the
  chat widget
- Server-side request forgery via the crawler, or any way to make it fetch a host it
  should refuse
- Prompt injection that causes the AI agent to reveal internal content it should not,
  or to act outside the requesting workspace
- Leakage of API keys, AI provider keys, or other secrets
- Injection (SQL, XSS, template) and remote code execution

**Out of scope:**

- Vulnerabilities in third-party services we depend on — report those to the vendor
- Missing security headers or best-practice warnings with no demonstrated impact
- Denial of service through sheer volume of traffic
- Social engineering, phishing, or physical attacks
- Automated scanner output submitted without a working proof of concept

## Self-hosting

If you self-host HelpNest, you are responsible for your own deployment's security.
At minimum:

- Set a strong, unique `AUTH_SECRET` and `AI_KEY_ENCRYPTION_SECRET`. Never reuse the
  values from `.env.example`.
- Change the seeded admin password immediately. The seed refuses to run in production
  without an explicit `ADMIN_SEED_PASSWORD` for exactly this reason.
- Set `PUBLIC_SIGNUP_ENABLED=false` if your instance should not accept new accounts.
  Hiding the signup link is not enough — the endpoint is public, and only this flag
  makes the server refuse.
- Keep your database and Qdrant instance off the public internet.
- Keep up with releases. We will not backport security fixes to old versions.

## A note on AI features

HelpNest sends article content and visitor questions to third-party AI providers. If
you handle regulated or highly sensitive data, review what leaves your infrastructure
before enabling AI features, and consider supplying your own provider key so that the
data is processed under your own agreement with that provider.

The AI agent answers only from your published articles and hands off to a human when
your knowledge base does not support an answer. This reduces the risk of a fabricated
answer, but it does not eliminate it: an answer drawn faithfully from an article that
is out of date will still be wrong. Keep your articles accurate.
