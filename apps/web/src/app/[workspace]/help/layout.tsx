import type { Metadata } from 'next'
import { getWorkspaceFontUrls, getWorkspaceThemeCSS } from '@/lib/branding'
import {
  hasWorkspaceFaviconColumn,
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
  hasWorkspaceMetaDescriptionColumn,
  hasWorkspaceMetaTitleColumn,
  prisma,
} from '@/lib/db'
import { notFound } from 'next/navigation'
import { cache } from 'react'

interface Props {
  children: React.ReactNode
  params: { workspace: string }
}

function toAbsoluteHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined

  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  } catch {
    return undefined
  }

  return undefined
}

const getWorkspaceHelpBranding = cache(async (slug: string) => {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, themeId: true, logo: true },
  })

  if (!workspace) return null

  const [
    fontPresetColumnExists,
    faviconColumnExists,
    metaTitleColumnExists,
    metaDescriptionColumnExists,
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
    hasWorkspaceFaviconColumn(),
    hasWorkspaceMetaTitleColumn(),
    hasWorkspaceMetaDescriptionColumn(),
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
    faviconRecord,
    metaTitleRecord,
    metaDescriptionRecord,
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
    faviconColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { favicon: true },
        })
      : Promise.resolve(null),
    metaTitleColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { metaTitle: true },
        })
      : Promise.resolve(null),
    metaDescriptionColumnExists
      ? prisma.workspace.findUnique({
          where: { id: workspace.id },
          select: { metaDescription: true },
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

  return {
    workspace: {
      ...workspace,
      favicon: faviconRecord?.favicon ?? null,
      metaTitle: metaTitleRecord?.metaTitle ?? null,
      metaDescription: metaDescriptionRecord?.metaDescription ?? null,
    },
    overrides: {
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
    },
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const state = await getWorkspaceHelpBranding(params.workspace)
  if (!state) return {}

  const title = state.workspace.metaTitle?.trim() || `${state.workspace.name} Help Center`
  const description =
    state.workspace.metaDescription?.trim() || `Support docs, guides, and answers for ${state.workspace.name}.`
  const iconUrl = state.workspace.favicon?.trim() || state.workspace.logo?.trim() || undefined
  const socialImage = toAbsoluteHttpUrl(state.workspace.logo?.trim())

  return {
    title,
    description,
    icons: iconUrl
      ? {
          icon: iconUrl,
          shortcut: iconUrl,
          apple: iconUrl,
        }
      : undefined,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: state.workspace.name,
      images: socialImage ? [{ url: socialImage }] : undefined,
    },
    twitter: {
      card: socialImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: socialImage ? [socialImage] : undefined,
    },
  }
}

/**
 * Help center layout — fetches the workspace's saved theme and injects it as
 * CSS variables into :root so every page beneath uses the correct colors/fonts
 * with no client-side flash. Google Fonts for the active theme are preloaded.
 */
export default async function HelpCenterLayout({ children, params }: Props) {
  const state = await getWorkspaceHelpBranding(params.workspace)
  if (!state) notFound()

  const css = getWorkspaceThemeCSS(state.workspace.themeId, state.overrides)
  const fontUrls = getWorkspaceFontUrls(state.workspace.themeId, state.overrides)

  return (
    <>
      {/* Preconnect to Google Fonts for faster font load */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

      {/* Load theme fonts — <link> tags are hoisted to <head> by React */}
      {fontUrls.map((url) => (
        <link key={url} rel="stylesheet" href={url} />
      ))}

      {/* Inject theme CSS variables — server-rendered, no flash */}
      <style dangerouslySetInnerHTML={{ __html: `:root { ${css} }` }} />

      {children}
    </>
  )
}
