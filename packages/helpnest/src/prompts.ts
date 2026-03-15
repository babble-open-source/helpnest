import { createInterface } from 'node:readline/promises'
import chalk from 'chalk'

/**
 * Generic Y/n confirmation prompt.
 * Returns true if the user accepts (Enter or y/Y).
 */
export async function confirm(message: string, autoYes = false): Promise<boolean> {
  if (autoYes) return true

  if (!process.stdin.isTTY) {
    console.error(chalk.red('Error: No interactive terminal detected. Pass --yes to skip prompts in CI.'))
    process.exit(1)
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`${message} [Y/n] `)
    const trimmed = answer.trim().toLowerCase()
    return trimmed === '' || trimmed === 'y' || trimmed === 'yes'
  } finally {
    rl.close()
  }
}

/**
 * Consent banner for local file access.
 * Shows the directory, file count, and what will happen before prompting.
 */
export async function confirmFileAccess(
  repoPath: string,
  fileCount: number,
  autoYes = false,
): Promise<boolean> {
  if (autoYes) return true

  console.log('')
  console.log(chalk.bold('  HelpNest needs to read source files from your repository.'))
  console.log('')
  console.log(`  Directory:   ${chalk.cyan(repoPath)}`)
  console.log(`  Files found: ${chalk.cyan(String(fileCount))} (via git ls-files)`)
  console.log('')
  console.log(chalk.dim('  File contents will be sent to your HelpNest instance for AI analysis.'))
  console.log(chalk.dim('  No data is sent to third parties beyond your configured HelpNest server.'))
  console.log('')

  return confirm('  Proceed?', autoYes)
}
