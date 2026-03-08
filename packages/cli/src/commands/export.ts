import ora from 'ora'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

interface ExportOptions {
  output: string
}

export async function exportCommand(options: ExportOptions) {
  console.log()
  const spinner = ora('Exporting articles...').start()

  const prisma = new PrismaClient()

  try {
    const workspaces = await prisma.workspace.findMany({
      include: {
        collections: {
          include: {
            articles: {
              where: { status: 'PUBLISHED' },
              include: { author: true },
            },
          },
        },
      },
    })

    let totalArticles = 0
    for (const w of workspaces) {
      for (const c of w.collections) {
        totalArticles += c.articles.length
      }
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1',
      workspaces,
    }

    const outputPath = path.resolve(process.cwd(), options.output)
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2))

    spinner.succeed(`Exported ${totalArticles} articles to ${chalk.cyan(outputPath)}`)
    console.log()
  } catch (e) {
    spinner.fail('Export failed')
    console.error(chalk.red(String(e)))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}
