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
  const fonts = await loadFonts()

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

  const emoji = collection?.emoji ?? '📄'
  const title = truncateText(collection?.title ?? 'Collection', 80)
  const description = collection?.description
    ? truncateText(collection.description, 140)
    : ''
  const articleCount = collection?._count?.articles ?? 0
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
          {/* Emoji */}
          <div style={{ fontSize: 80, marginBottom: 20 }}>{emoji}</div>

          {/* Collection title */}
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

          {/* Description + count */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 20,
            }}
          >
            {description && (
              <div
                style={{
                  fontSize: 28,
                  color: colors.muted,
                  fontFamily: '"DM Sans"',
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
                fontFamily: '"DM Sans"',
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
