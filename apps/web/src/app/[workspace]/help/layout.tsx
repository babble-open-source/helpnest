import { prisma } from '@/lib/db'
import { getTheme, themeToCSS } from '@/lib/themes'
import { notFound } from 'next/navigation'

interface Props {
  children: React.ReactNode
  params: { workspace: string }
}

/**
 * Help center layout — fetches the workspace's saved theme and injects it as
 * CSS variables into :root so every page beneath uses the correct colors/fonts
 * with no client-side flash. Google Fonts for the active theme are preloaded.
 */
export default async function HelpCenterLayout({ children, params }: Props) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspace },
    select: { themeId: true },
  })

  if (!workspace) notFound()

  const theme = getTheme(workspace.themeId)
  const css = themeToCSS(theme)

  const fontUrls = [theme.fonts.headingUrl, theme.fonts.bodyUrl].filter(Boolean) as string[]

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
