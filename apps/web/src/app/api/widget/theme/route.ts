import { getWorkspaceFontUrls, getWorkspaceThemeCSS } from '@/lib/branding'
import {
  hasWorkspaceBrandTextColumn,
  hasWorkspaceCustomAccentColorColumn,
  hasWorkspaceCustomBrandFontFamilyColumn,
  hasWorkspaceCustomBrandFontUrlColumn,
  hasWorkspaceCustomBodyFontFamilyColumn,
  hasWorkspaceCustomBodyFontUrlColumn,
  hasWorkspaceCustomBorderColorColumn,
  hasWorkspaceCustomCreamColorColumn,
  hasWorkspaceCustomGreenColorColumn,
  hasWorkspaceCustomHeadingFontFamilyColumn,
  hasWorkspaceCustomHeadingFontUrlColumn,
  hasWorkspaceCustomInkColorColumn,
  hasWorkspaceCustomMutedColorColumn,
  hasWorkspaceCustomRadiusColumn,
  hasWorkspaceCustomWhiteColorColumn,
  hasWorkspaceFontPresetColumn,
  prisma,
} from '@/lib/db'
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
    select: { id: true, name: true, themeId: true, logo: true },
  })

  if (!workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  const [
    fontPresetColumnExists,
    brandTextColumnExists,
    customCreamColorColumnExists,
    customInkColorColumnExists,
    customMutedColorColumnExists,
    customBorderColorColumnExists,
    customAccentColorColumnExists,
    customGreenColorColumnExists,
    customWhiteColorColumnExists,
    customRadiusColumnExists,
    customHeadingFontFamilyColumnExists,
    customHeadingFontUrlColumnExists,
    customBodyFontFamilyColumnExists,
    customBodyFontUrlColumnExists,
    customBrandFontFamilyColumnExists,
    customBrandFontUrlColumnExists,
  ] = await Promise.all([
    hasWorkspaceFontPresetColumn(),
    hasWorkspaceBrandTextColumn(),
    hasWorkspaceCustomCreamColorColumn(),
    hasWorkspaceCustomInkColorColumn(),
    hasWorkspaceCustomMutedColorColumn(),
    hasWorkspaceCustomBorderColorColumn(),
    hasWorkspaceCustomAccentColorColumn(),
    hasWorkspaceCustomGreenColorColumn(),
    hasWorkspaceCustomWhiteColorColumn(),
    hasWorkspaceCustomRadiusColumn(),
    hasWorkspaceCustomHeadingFontFamilyColumn(),
    hasWorkspaceCustomHeadingFontUrlColumn(),
    hasWorkspaceCustomBodyFontFamilyColumn(),
    hasWorkspaceCustomBodyFontUrlColumn(),
    hasWorkspaceCustomBrandFontFamilyColumn(),
    hasWorkspaceCustomBrandFontUrlColumn(),
  ])
  const [
    fontPresetRecord,
    brandTextRecord,
    customCreamColorRecord,
    customInkColorRecord,
    customMutedColorRecord,
    customBorderColorRecord,
    customAccentColorRecord,
    customGreenColorRecord,
    customWhiteColorRecord,
    customRadiusRecord,
    customHeadingFontFamilyRecord,
    customHeadingFontUrlRecord,
    customBodyFontFamilyRecord,
    customBodyFontUrlRecord,
    customBrandFontFamilyRecord,
    customBrandFontUrlRecord,
  ] = await Promise.all([
    fontPresetColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { fontPresetId: true },
        })
      : Promise.resolve(null),
    brandTextColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { brandText: true },
        })
      : Promise.resolve(null),
    customCreamColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: workspace.id }, select: { customCreamColor: true } })
      : Promise.resolve(null),
    customInkColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: workspace.id }, select: { customInkColor: true } })
      : Promise.resolve(null),
    customMutedColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: workspace.id }, select: { customMutedColor: true } })
      : Promise.resolve(null),
    customBorderColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: workspace.id }, select: { customBorderColor: true } })
      : Promise.resolve(null),
    customAccentColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: workspace.id }, select: { customAccentColor: true } })
      : Promise.resolve(null),
    customGreenColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: workspace.id }, select: { customGreenColor: true } })
      : Promise.resolve(null),
    customWhiteColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: workspace.id }, select: { customWhiteColor: true } })
      : Promise.resolve(null),
    customRadiusColumnExists
      ? prisma.workspace.findUnique({ where: { id: workspace.id }, select: { customRadius: true } })
      : Promise.resolve(null),
    customHeadingFontFamilyColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { customHeadingFontFamily: true },
        })
      : Promise.resolve(null),
    customHeadingFontUrlColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { customHeadingFontUrl: true },
        })
      : Promise.resolve(null),
    customBodyFontFamilyColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { customBodyFontFamily: true },
        })
      : Promise.resolve(null),
    customBodyFontUrlColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { customBodyFontUrl: true },
        })
      : Promise.resolve(null),
    customBrandFontFamilyColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { customBrandFontFamily: true },
        })
      : Promise.resolve(null),
    customBrandFontUrlColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { customBrandFontUrl: true },
        })
      : Promise.resolve(null),
  ])
  const overrides = {
    brandText: brandTextRecord?.brandText ?? null,
    fontPresetId: fontPresetRecord?.fontPresetId ?? null,
    customCreamColor: customCreamColorRecord?.customCreamColor ?? null,
    customInkColor: customInkColorRecord?.customInkColor ?? null,
    customMutedColor: customMutedColorRecord?.customMutedColor ?? null,
    customBorderColor: customBorderColorRecord?.customBorderColor ?? null,
    customAccentColor: customAccentColorRecord?.customAccentColor ?? null,
    customGreenColor: customGreenColorRecord?.customGreenColor ?? null,
    customWhiteColor: customWhiteColorRecord?.customWhiteColor ?? null,
    customRadius: (customRadiusRecord?.customRadius as 'none' | 'sm' | 'md' | 'lg' | 'xl' | null) ?? null,
    customHeadingFontFamily: customHeadingFontFamilyRecord?.customHeadingFontFamily ?? null,
    customHeadingFontUrl: customHeadingFontUrlRecord?.customHeadingFontUrl ?? null,
    customBodyFontFamily: customBodyFontFamilyRecord?.customBodyFontFamily ?? null,
    customBodyFontUrl: customBodyFontUrlRecord?.customBodyFontUrl ?? null,
    customBrandFontFamily: customBrandFontFamilyRecord?.customBrandFontFamily ?? null,
    customBrandFontUrl: customBrandFontUrlRecord?.customBrandFontUrl ?? null,
  }
  const vars = cssToVars(getWorkspaceThemeCSS(workspace.themeId, overrides))
  const fontUrls = getWorkspaceFontUrls(workspace.themeId, overrides)

  return NextResponse.json(
    {
      vars,
      fontUrls,
      logoUrl: workspace.logo,
      brandText: brandTextRecord?.brandText?.trim() || workspace.name,
    },
    {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  )
}
