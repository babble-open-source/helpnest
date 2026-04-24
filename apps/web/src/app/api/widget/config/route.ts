import { getWorkspaceFontUrls, getWorkspaceThemeCSS } from '@/lib/branding'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
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

  const columns = await getWorkspaceColumnSet()

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      themeId: true,
      aiEnabled: true,
      aiGreeting: true,
      // Migration-guarded fields
      ...(columns.has('widgetResponseTime') ? { widgetResponseTime: true } : {}),
      ...(columns.has('brandText') ? { brandText: true } : {}),
      ...(columns.has('fontPresetId') ? { fontPresetId: true } : {}),
      ...(columns.has('customCreamColor') ? { customCreamColor: true } : {}),
      ...(columns.has('customInkColor') ? { customInkColor: true } : {}),
      ...(columns.has('customMutedColor') ? { customMutedColor: true } : {}),
      ...(columns.has('customBorderColor') ? { customBorderColor: true } : {}),
      ...(columns.has('customAccentColor') ? { customAccentColor: true } : {}),
      ...(columns.has('customGreenColor') ? { customGreenColor: true } : {}),
      ...(columns.has('customWhiteColor') ? { customWhiteColor: true } : {}),
      ...(columns.has('customRadius') ? { customRadius: true } : {}),
      ...(columns.has('customHeadingFontFamily') ? { customHeadingFontFamily: true } : {}),
      ...(columns.has('customHeadingFontUrl') ? { customHeadingFontUrl: true } : {}),
      ...(columns.has('customBodyFontFamily') ? { customBodyFontFamily: true } : {}),
      ...(columns.has('customBodyFontUrl') ? { customBodyFontUrl: true } : {}),
      ...(columns.has('customBrandFontFamily') ? { customBrandFontFamily: true } : {}),
      ...(columns.has('customBrandFontUrl') ? { customBrandFontUrl: true } : {}),
      ...(columns.has('customDomain') ? { customDomain: true } : {}),
    },
  })

  if (!workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  const overrides = {
    brandText: workspace.brandText ?? null,
    fontPresetId: workspace.fontPresetId ?? null,
    customCreamColor: workspace.customCreamColor ?? null,
    customInkColor: workspace.customInkColor ?? null,
    customMutedColor: workspace.customMutedColor ?? null,
    customBorderColor: workspace.customBorderColor ?? null,
    customAccentColor: workspace.customAccentColor ?? null,
    customGreenColor: workspace.customGreenColor ?? null,
    customWhiteColor: workspace.customWhiteColor ?? null,
    customRadius: (workspace.customRadius as 'none' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? null,
    customHeadingFontFamily: workspace.customHeadingFontFamily ?? null,
    customHeadingFontUrl: workspace.customHeadingFontUrl ?? null,
    customBodyFontFamily: workspace.customBodyFontFamily ?? null,
    customBodyFontUrl: workspace.customBodyFontUrl ?? null,
    customBrandFontFamily: workspace.customBrandFontFamily ?? null,
    customBrandFontUrl: workspace.customBrandFontUrl ?? null,
  }

  const vars = cssToVars(getWorkspaceThemeCSS(workspace.themeId, overrides))
  const fontUrls = getWorkspaceFontUrls(workspace.themeId, overrides)

  // Determine help center base URL: custom domain takes priority; otherwise derive from
  // the request host so that local dev (http://localhost:3000) and production both work correctly.
  // Always include the full path prefix so consumers can append /{collection}/{article} directly.
  const customDomain = (workspace as unknown as Record<string, unknown>).customDomain as string | null ?? null
  const requestUrl = new URL(request.url)
  const appBase = `${requestUrl.protocol}//${requestUrl.host}`
  const helpCenterUrl = customDomain
    ? `https://${customDomain}`
    : `${appBase}/${workspace.slug}/help`

  return NextResponse.json(
    {
      workspaceId: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logo: workspace.logo ?? null,
      aiEnabled: workspace.aiEnabled,
      aiGreeting: workspace.aiGreeting?.trim() || 'Hi there! How can we help?',
      widgetResponseTime: workspace.widgetResponseTime ?? null,
      helpCenterUrl,
      theme: {
        vars,
        fontUrls,
      },
    },
    {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    },
  )
}
