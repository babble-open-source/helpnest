import ora from 'ora'
import chalk from 'chalk'
import { execa } from 'execa'
import * as fs from 'fs'
import * as path from 'path'

export async function devCommand() {
  console.log()
  console.log(chalk.bold('  🪺  HelpNest Dev Server'))
  console.log()

  // Check .env exists
  if (!fs.existsSync(path.join(process.cwd(), '.env'))) {
    console.log(chalk.yellow('  No .env found. Run helpnest init first.'))
    process.exit(1)
  }

  // Start Docker services if docker-compose.yml exists
  const hasCompose = fs.existsSync(path.join(process.cwd(), 'docker-compose.yml'))
  if (hasCompose) {
    const dockerSpinner = ora('Starting Docker services...').start()
    try {
      await execa('docker', ['compose', 'up', '-d'], { cwd: process.cwd() })
      dockerSpinner.succeed('Docker services running')
    } catch {
      dockerSpinner.warn('Could not start Docker (is it running?)')
    }
  }

  console.log(chalk.dim('  Starting dev server on http://localhost:3000\n'))

  // Start Next.js dev server — streams output
  const proc = execa('pnpm', ['dev'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })

  proc.catch(() => {}) // suppress execa error on ctrl+c
  await proc
}
