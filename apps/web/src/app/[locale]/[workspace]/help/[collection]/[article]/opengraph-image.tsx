import { ImageResponse } from 'next/og'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { OG_SIZE, resolveOgColors, loadFonts, truncateText, type OgFonts } from '@/lib/og-utils'

export const revalidate = 3600
export const size = OG_SIZE
export const contentType = 'image/png'

interface Props {
  params: Promise<{ workspace: string; article: string }>
}

export default async function OgImage(props: Props) {
  const params = await props.params

  const columns = await getWorkspaceColumnSet()
  const workspace = await prisma.workspace.findFirst({
    where: { slug: params.workspace },
    select: {
      name: true,
      themeId: true,
      ...(columns.has('customCreamColor') ? { customCreamColor: true } : {}),
      ...(columns.has('customInkColor') ? { customInkColor: true } : {}),
      ...(columns.has('customMutedColor') ? { customMutedColor: true } : {}),
      ...(columns.has('customBorderColor') ? { customBorderColor: true } : {}),
      ...(columns.has('customAccentColor') ? { customAccentColor: true } : {}),
      ...(columns.has('fontPresetId') ? { fontPresetId: true } : {}),
      ...(columns.has('customHeadingFontFamily') ? { customHeadingFontFamily: true } : {}),
      ...(columns.has('customHeadingFontUrl') ? { customHeadingFontUrl: true } : {}),
      ...(columns.has('customBodyFontFamily') ? { customBodyFontFamily: true } : {}),
      ...(columns.has('customBodyFontUrl') ? { customBodyFontUrl: true } : {}),
      ...(columns.has('customBrandFontFamily') ? { customBrandFontFamily: true } : {}),
      ...(columns.has('customBrandFontUrl') ? { customBrandFontUrl: true } : {}),
    },
  })

  const article = workspace
    ? await prisma.article.findFirst({
        where: { slug: params.article, workspace: { slug: params.workspace } },
        select: {
          title: true,
          author: { select: { name: true } },
          collection: { select: { title: true, emoji: true } },
        },
      })
    : null

  const colors = resolveOgColors(workspace?.themeId ?? 'default', {
    customCreamColor: workspace?.customCreamColor ?? null,
    customInkColor: workspace?.customInkColor ?? null,
    customMutedColor: workspace?.customMutedColor ?? null,
    customBorderColor: workspace?.customBorderColor ?? null,
    customAccentColor: workspace?.customAccentColor ?? null,
  })

  const fonts = await loadFonts(workspace?.themeId ?? 'default', {
    fontPresetId: workspace?.fontPresetId ?? null,
    customHeadingFontFamily: workspace?.customHeadingFontFamily ?? null,
    customHeadingFontUrl: workspace?.customHeadingFontUrl ?? null,
    customBodyFontFamily: workspace?.customBodyFontFamily ?? null,
    customBodyFontUrl: workspace?.customBodyFontUrl ?? null,
    customBrandFontFamily: workspace?.customBrandFontFamily ?? null,
    customBrandFontUrl: workspace?.customBrandFontUrl ?? null,
  })

  const title = truncateText(article?.title ?? 'Article', 70)
  const collectionLabel = article?.collection
    ? `${article.collection.emoji ?? '📄'} ${article.collection.title}`
    : ''
  const authorName = article?.author?.name ? `By ${article.author.name}` : ''
  const workspaceName = workspace?.name ?? ''

  // Workspace name uses brand font if set, otherwise heading font
  const brandFontFamily = fonts.brand
    ? `"${fonts.brand.name}"`
    : `"${fonts.heading.name}"`

  // Build font list for Satori
  const fontList: { name: string; data: ArrayBuffer; style: 'normal' }[] = [
    { name: fonts.heading.name, data: fonts.heading.data, style: 'normal' },
    { name: fonts.body.name, data: fonts.body.data, style: 'normal' },
  ]
  if (fonts.brand) {
    fontList.push({ name: fonts.brand.name, data: fonts.brand.data, style: 'normal' })
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.cream,
        }}
      >
        {/* Content area — centered for square-crop platforms like WhatsApp */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '48px 80px',
          }}
        >
          {/* Collection label */}
          {collectionLabel && (
            <div
              style={{
                fontSize: 28,
                color: colors.accent,
                fontFamily: `"${fonts.body.name}"`,
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              {collectionLabel}
            </div>
          )}

          {/* Article title */}
          <div
            style={{
              fontSize: 64,
              fontFamily: `"${fonts.heading.name}"`,
              color: colors.ink,
              lineHeight: 1.15,
            }}
          >
            {title}
          </div>

          {/* Author */}
          {authorName && (
            <div
              style={{
                fontSize: 26,
                color: colors.muted,
                fontFamily: `"${fonts.body.name}"`,
                marginTop: 24,
              }}
            >
              {authorName}
            </div>
          )}
        </div>

        {/* Bottom branding bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            backgroundColor: colors.ink,
            padding: '24px 64px',
          }}
        >
          <div
            style={{
              fontSize: 26,
              color: colors.cream,
              fontFamily: brandFontFamily,
            }}
          >
            {workspaceName}
          </div>
          <div
            style={{
              fontSize: 20,
              color: colors.muted,
              fontFamily: `"${fonts.body.name}"`,
            }}
          >
            Help Center
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontList,
    },
  )
}
