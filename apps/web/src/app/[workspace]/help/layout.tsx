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
      {/* Inject theme CSS variables — server-rendered, no flash */}
      <style dangerouslySetInnerHTML={{ __html: `${fontUrls.map((url) => `@import url('${url}');`).join('\n')}
:root { ${css} }` }} />

      {children}
    </>
  )
}
