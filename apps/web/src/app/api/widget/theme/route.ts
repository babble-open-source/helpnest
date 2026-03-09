import { prisma } from '@/lib/db'
import { getTheme, themeToCSS } from '@/lib/themes'
import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function cssToVars(css: string): Record<string, string> {
  const vars: Record<string, string> = {}

  for (const declaration of css.split(';')) {
    const trimmed = declaration.trim()
    if (!trimmed) continue

    const separator = trimmed.indexOf(':')
    if (separator <= 0) continue

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (!key.startsWith('--') || value.length === 0) continue

    vars[key] = value
  }

  return vars
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const workspaceSlug = searchParams.get('workspace')?.trim() ?? ''

  if (
    workspaceSlug.length === 0 ||
    workspaceSlug.length > 63 ||
    !SLUG_RE.test(workspaceSlug)
  ) {
    return NextResponse.json(
      { error: 'Invalid workspace slug' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { themeId: true },
  })

  if (!workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  const theme = getTheme(workspace.themeId)
  const vars = cssToVars(themeToCSS(theme))

  return NextResponse.json(
    { vars },
    {
      headers: {
        ...CORS_HEADERS,
        // Keep theme payload cacheable but reasonably fresh.
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    },
  )
}
