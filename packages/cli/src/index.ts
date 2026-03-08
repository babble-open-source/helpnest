#!/usr/bin/env node
import { program } from 'commander'
import { initCommand } from './commands/init'
import { devCommand } from './commands/dev'
import { exportCommand } from './commands/export'
import { importCommand } from './commands/import'
import { deployCommand } from './commands/deploy'

program
  .name('helpnest')
  .description('The HelpNest CLI — set up, run, and deploy your help center')
  .version('0.0.1')

program
  .command('init')
  .description('Set up a new HelpNest workspace')
  .action(initCommand)

program
  .command('dev')
  .description('Start the local development server')
  .action(devCommand)

program
  .command('export')
  .description('Export all articles and collections to JSON')
  .option('-o, --output <path>', 'Output file path', './helpnest-export.json')
  .action(exportCommand)

program
  .command('import')
  .description('Import articles from Intercom, Zendesk, or HelpNest export')
  .option('-f, --file <path>', 'Input file path')
  .option('--format <format>', 'Source format: intercom | zendesk | helpnest', 'helpnest')
  .action(importCommand)

program
  .command('deploy')
  .description('Deploy HelpNest to a hosting provider')
  .option('--target <target>', 'Deploy target: vercel | railway | docker', 'docker')
  .action(deployCommand)

program.parse()
