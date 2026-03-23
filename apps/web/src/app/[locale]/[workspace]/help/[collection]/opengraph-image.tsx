import { ImageResponse } from 'next/og'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { OG_SIZE, resolveOgColors, loadFonts, truncateText } from '@/lib/og-utils'

export const revalidate = 3600
export const size = OG_SIZE
export const contentType = 'image/png'

interface Props {
  params: Promise<{ workspace: string; collection: string }>
}

export default async function OgImage(props: Props) {
  const params = await props.params

  const columns = await getWorkspaceColumnSet()
  const workspace = await prisma.workspace.findFirst({
    where: { slug: params.workspace },
    select: {
      id: true,
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

  const collection = workspace
    ? await prisma.collection.findUnique({
        where: { workspaceId_slug: { workspaceId: workspace.id, slug: params.collection } },
        select: {
          title: true,
          emoji: true,
          description: true,
          _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
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

  const emoji = collection?.emoji ?? '📄'
  const title = truncateText(collection?.title ?? 'Collection', 80)
  const description = collection?.description
    ? truncateText(collection.description, 140)
    : ''
  const articleCount = collection?._count?.articles ?? 0
  const workspaceName = workspace?.name ?? ''

  const brandFontFamily = fonts.brand
    ? `"${fonts.brand.name}"`
    : `"${fonts.heading.name}"`

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
          {/* Emoji */}
          <div style={{ fontSize: 80, marginBottom: 20 }}>{emoji}</div>

          {/* Collection title */}
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

          {/* Description + count */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: 20,
            }}
          >
            {description && (
              <div
                style={{
                  fontSize: 28,
                  color: colors.muted,
                  fontFamily: `"${fonts.body.name}"`,
                  lineHeight: 1.4,
                  marginBottom: 12,
                }}
              >
                {description}
              </div>
            )}
            <div
              style={{
                fontSize: 24,
                color: colors.accent,
                fontFamily: `"${fonts.body.name}"`,
                fontWeight: 600,
              }}
            >
              {`${articleCount} ${articleCount === 1 ? 'article' : 'articles'}`}
            </div>
          </div>
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
