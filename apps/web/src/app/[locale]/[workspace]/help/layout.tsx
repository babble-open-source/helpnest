import type { Metadata } from 'next'
import { getWorkspaceFontUrls, getWorkspaceThemeCSS } from '@/lib/branding'
import { locales } from '@/i18n/config'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { cache } from 'react'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string; workspace: string }>
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
  const columns = await getWorkspaceColumnSet()

  const workspace = await prisma.workspace.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      themeId: true,
      logo: true,
      // Migration-guarded branding fields — only selected when the column exists
      ...(columns.has('favicon') ? { favicon: true } : {}),
      ...(columns.has('metaTitle') ? { metaTitle: true } : {}),
      ...(columns.has('metaDescription') ? { metaDescription: true } : {}),
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
    },
  })

  if (!workspace) return null

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      themeId: workspace.themeId,
      logo: workspace.logo,
      favicon: workspace.favicon ?? null,
      metaTitle: workspace.metaTitle ?? null,
      metaDescription: workspace.metaDescription ?? null,
    },
    overrides: {
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
    },
  }
})

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
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
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [l, `/${l}/${params.workspace}/help`]),
      ),
    },
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
export default async function HelpCenterLayout({ children, ...props }: Props) {
  const params = await props.params
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
