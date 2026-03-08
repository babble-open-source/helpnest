import ora from 'ora'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

interface ImportOptions {
  file?: string
  format: string
}

interface HelpNestExport {
  version: string
  workspaces: Array<{
    name: string
    slug: string
    collections: Array<{
      title: string
      description?: string
      emoji?: string
      slug: string
      articles: Array<{
        title: string
        slug: string
        content: string
        excerpt?: string
      }>
    }>
  }>
}

interface IntercomArticle {
  title: string
  body: string
  description?: string
  url?: string
  parent_id?: string
}

interface IntercomExport {
  articles?: IntercomArticle[]
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
}

export async function importCommand(options: ImportOptions) {
  console.log()

  if (!options.file) {
    console.log(chalk.red('  --file is required. Example: helpnest import --file ./export.json'))
    process.exit(1)
  }

  const filePath = path.resolve(process.cwd(), options.file)
  if (!fs.existsSync(filePath)) {
    console.log(chalk.red(`  File not found: ${filePath}`))
    process.exit(1)
  }

  const spinner = ora(`Importing from ${options.format}...`).start()

  const prisma = new PrismaClient()

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as HelpNestExport | IntercomExport

    const workspace = await prisma.workspace.findFirst()
    if (!workspace) {
      spinner.fail('No workspace found. Run helpnest init first.')
      process.exit(1)
    }

    const adminUser = await prisma.user.findFirst()
    if (!adminUser) {
      spinner.fail('No users found. Run helpnest init first.')
      process.exit(1)
    }

    let imported = 0

    if (options.format === 'helpnest') {
      const hn = data as HelpNestExport
      for (const ws of hn.workspaces ?? []) {
        for (const col of ws.collections ?? []) {
          const collection = await prisma.collection.upsert({
            where: { workspaceId_slug: { workspaceId: workspace.id, slug: col.slug } },
            update: {},
            create: {
              workspaceId: workspace.id,
              title: col.title,
              description: col.description,
              emoji: col.emoji,
              slug: col.slug,
              isPublic: true,
            },
          })
          for (const art of col.articles ?? []) {
            await prisma.article.upsert({
              where: { workspaceId_slug: { workspaceId: workspace.id, slug: art.slug } },
              update: { content: art.content, title: art.title },
              create: {
                workspaceId: workspace.id,
                collectionId: collection.id,
                authorId: adminUser.id,
                title: art.title,
                slug: art.slug,
                content: art.content,
                excerpt: art.excerpt,
                status: 'PUBLISHED',
                publishedAt: new Date(),
              },
            })
            imported++
          }
        }
      }
    } else if (options.format === 'intercom') {
      const ic = data as IntercomExport
      // Default collection for Intercom imports
      let col = await prisma.collection.findFirst({ where: { workspaceId: workspace.id } })
      if (!col) {
        col = await prisma.collection.create({
          data: {
            workspaceId: workspace.id,
            title: 'Imported Articles',
            slug: 'imported',
            emoji: '📥',
            isPublic: true,
          },
        })
      }
      for (const art of ic.articles ?? []) {
        const slug = slugify(art.title)
        await prisma.article.upsert({
          where: { workspaceId_slug: { workspaceId: workspace.id, slug } },
          update: {},
          create: {
            workspaceId: workspace.id,
            collectionId: col.id,
            authorId: adminUser.id,
            title: art.title,
            slug,
            content: art.body ?? '',
            excerpt: art.description,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        })
        imported++
      }
    }

    spinner.succeed(`Imported ${imported} articles`)
    console.log()
  } catch (e) {
    spinner.fail('Import failed')
    console.error(chalk.red(String(e)))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}
