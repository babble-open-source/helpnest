#!/usr/bin/env node
import { program } from 'commander'
import { draftCommand } from './commands/draft.js'
import { seedCommand } from './commands/seed.js'

program
  .name('helpnest')
  .description('HelpNest CLI — auto-draft KB articles from PRs and GitHub history')
  .version('0.3.0')

program
  .command('draft')
  .description('Auto-draft a KB article from a PR or topic')
  .option('--pr-title <title>', 'PR or change title')
  .option('--topic <topic>', 'Plain text topic or question to draft an article about')
  .option('--pr-body <body>', 'PR description')
  .option('--diff <diff>', 'Code diff (opt-in)')
  .option('--collection <id>', 'Target collection ID or slug')
  .option('--feature-id <id>', 'Shared feature ID for multi-repo batching')
  .option('--local <path>', 'Local repo path to scan for code context (used with --topic)')
  .option('--rounds <n>', 'Max refinement rounds for code context scanning (default: 3)', '3')
  .option('--api-key <key>', 'HelpNest API key (or HELPNEST_API_KEY env)')
  .option('--base-url <url>', 'HelpNest base URL', 'https://helpnest.cloud')
  .option('-y, --yes', 'Skip interactive prompts (for CI/automation)')
  .action(draftCommand)

program
  .command('seed')
  .description('Bootstrap KB articles from repo content (README, docs, releases, PRs, git history)')
  .option('--repo <owner/repo>', 'GitHub repository (required for GitHub mode)')
  .option('--local <path>', 'Local repo path (enables local mode, no token needed)')
  .option('--token <token>', 'GitHub token (or GITHUB_TOKEN env)')
  .option('--source <sources>', 'Comma-separated sources: readme,docs,releases,prs,code (default: all)', 'all')
  .option('--limit <n>', 'Max items per source to process', '50')
  .option('--from <date>', 'Only PRs/releases after this date (ISO 8601)')
  .option('--delay <ms>', 'ms between API calls', '200')
  .option('--collection <id>', 'Target collection')
  .option('--topics <topics>', 'Comma-separated list of topics to draft articles for directly')
  .option('--rounds <n>', 'Max refinement rounds for code context scanning (default: 3)', '3')
  .option('--dry-run', 'Preview without generating')
  .option('--api-key <key>', 'HelpNest API key (or HELPNEST_API_KEY env)')
  .option('--base-url <url>', 'HelpNest base URL', 'https://helpnest.cloud')
  .option('-y, --yes', 'Skip interactive prompts (for CI/automation)')
  .action(seedCommand)

program.parse()
