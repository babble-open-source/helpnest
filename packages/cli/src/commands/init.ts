import inquirer from 'inquirer'
import ora from 'ora'
import chalk from 'chalk'
import { execa } from 'execa'
import * as fs from 'fs'
import * as path from 'path'

export async function initCommand() {
  console.log()
  console.log(chalk.bold('  🪺  HelpNest Setup'))
  console.log(chalk.dim('  Let\'s get your help center running.\n'))

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'workspaceName',
      message: 'Workspace name:',
      default: 'My Company',
      validate: (v: string) => v.trim().length > 0 || 'Required',
    },
    {
      type: 'input',
      name: 'workspaceSlug',
      message: 'Workspace slug (used in URL):',
      default: (ans: { workspaceName: string }) =>
        ans.workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      validate: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Only lowercase letters, numbers, and hyphens',
    },
    {
      type: 'input',
      name: 'dbUrl',
      message: 'PostgreSQL database URL:',
      default: 'postgresql://helpnest:helpnest@localhost:5432/helpnest_dev',
      validate: (v: string) => v.startsWith('postgresql://') || 'Must be a valid PostgreSQL URL',
    },
    {
      type: 'input',
      name: 'adminEmail',
      message: 'Admin email:',
      validate: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Enter a valid email',
    },
  ])

  // Write .env if it doesn't exist
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) {
    const envExample = path.join(process.cwd(), '.env.example')
    if (fs.existsSync(envExample)) {
      let env = fs.readFileSync(envExample, 'utf-8')
      env = env.replace(
        'postgresql://helpnest:helpnest@localhost:5432/helpnest_dev',
        answers.dbUrl
      )
      fs.writeFileSync(envPath, env)
    } else {
      fs.writeFileSync(envPath, `DATABASE_URL=${answers.dbUrl}\nNEXT_PUBLIC_APP_URL=http://localhost:3000\n`)
    }
    console.log(chalk.dim('  Created .env'))
  }

  // Resolve packages/db — works whether CLI is run from repo root or packages/cli
  const dbDir = fs.existsSync(path.join(process.cwd(), 'packages/db'))
    ? path.join(process.cwd(), 'packages/db')
    : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../db')

  // Run migrations
  const migrateSpinner = ora('Running database migrations...').start()
  try {
    await execa('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: dbDir,
      env: { ...process.env, DATABASE_URL: answers.dbUrl },
    })
    migrateSpinner.succeed('Migrations complete')
  } catch (e) {
    migrateSpinner.fail('Migration failed — check your DATABASE_URL')
    console.error(chalk.red(String(e)))
    process.exit(1)
  }

  // Seed initial workspace via API or direct DB call
  const seedSpinner = ora('Creating workspace...').start()
  try {
    await execa('npx', ['prisma', 'db', 'seed'], {
      cwd: dbDir,
      env: {
        ...process.env,
        DATABASE_URL: answers.dbUrl,
        SEED_WORKSPACE_NAME: answers.workspaceName,
        SEED_WORKSPACE_SLUG: answers.workspaceSlug,
        SEED_ADMIN_EMAIL: answers.adminEmail,
      },
    })
    seedSpinner.succeed('Workspace created')
  } catch {
    seedSpinner.warn('Skipped seed (may already exist)')
  }

  console.log()
  console.log(chalk.green.bold('  ✓ HelpNest is ready!'))
  console.log()
  console.log(chalk.dim('  Next steps:'))
  console.log(`  ${chalk.cyan('pnpm dev')}          Start the dev server`)
  console.log(`  ${chalk.cyan(`/${answers.workspaceSlug}/help`)}  Your help center`)
  console.log(`  ${chalk.cyan('/dashboard')}        Admin dashboard`)
  console.log()
}
