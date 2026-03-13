import ora from 'ora'
import chalk from 'chalk'
import { execa } from 'execa'
import * as fs from 'fs'
import * as path from 'path'

export async function devCommand() {
  console.log()
  console.log(chalk.bold('  🪺  HelpNest Dev Server'))
  console.log()

  // Resolve repo root — works from monorepo root or packages/cli
  const repoRoot = fs.existsSync(path.join(process.cwd(), 'apps/web'))
    ? process.cwd()
    : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..')

  // Check .env exists
  if (!fs.existsSync(path.join(repoRoot, 'apps/web/.env'))) {
    console.log(chalk.yellow('  No .env found in apps/web. Run helpnest init first.'))
    process.exit(1)
  }

  // Start Docker services if docker-compose.yml exists
  const hasCompose = fs.existsSync(path.join(repoRoot, 'docker-compose.yml'))
  if (hasCompose) {
    const dockerSpinner = ora('Starting Docker services...').start()
    try {
      await execa('docker', ['compose', 'up', '-d'], { cwd: repoRoot })
      dockerSpinner.succeed('Docker services running')
    } catch {
      dockerSpinner.warn('Could not start Docker (is it running?)')
    }
  }

  // Resolve apps/web — works from monorepo root or packages/cli
  const webDir = fs.existsSync(path.join(process.cwd(), 'apps/web'))
    ? path.join(process.cwd(), 'apps/web')
    : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../apps/web')

  console.log(chalk.dim('  Starting dev server on http://localhost:3000\n'))

  // Start Next.js dev server — streams output
  const proc = execa('npx', ['next', 'dev'], {
    cwd: webDir,
    stdio: 'inherit',
  })

  proc.catch(() => {}) // suppress execa error on ctrl+c
  await proc
}
