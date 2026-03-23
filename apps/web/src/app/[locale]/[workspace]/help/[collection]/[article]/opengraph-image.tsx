import { ImageResponse } from 'next/og'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { OG_SIZE, resolveOgColors, loadFonts, truncateText } from '@/lib/og-utils'

export const revalidate = 3600
export const size = OG_SIZE
export const contentType = 'image/png'

interface Props {
  params: Promise<{ workspace: string; article: string }>
}

export default async function OgImage(props: Props) {
  const params = await props.params
  const fonts = await loadFonts()

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

  const title = truncateText(article?.title ?? 'Article', 70)
  const collectionLabel = article?.collection
    ? `${article.collection.emoji ?? '📄'} ${article.collection.title}`
    : ''
  const authorName = article?.author?.name ? `By ${article.author.name}` : ''
  const workspaceName = workspace?.name ?? ''

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
        {/* Content area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '48px 64px',
          }}
        >
          {/* Collection label */}
          {collectionLabel && (
            <div
              style={{
                fontSize: 28,
                color: colors.accent,
                fontFamily: '"DM Sans"',
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
              fontFamily: '"Instrument Serif"',
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
                fontFamily: '"DM Sans"',
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
            justifyContent: 'space-between',
            backgroundColor: colors.ink,
            padding: '24px 64px',
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: colors.cream,
              fontFamily: '"Instrument Serif"',
            }}
          >
            {workspaceName}
          </div>
          <div
            style={{
              fontSize: 22,
              color: colors.muted,
              fontFamily: '"DM Sans"',
            }}
          >
            Help Center
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Instrument Serif', data: fonts.instrumentSerif, style: 'normal' },
        { name: 'DM Sans', data: fonts.dmSans, style: 'normal' },
      ],
    },
  )
}
