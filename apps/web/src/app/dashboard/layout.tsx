import { auth, resolveSessionUserId } from '@/lib/auth'
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
import { redirect } from 'next/navigation'
import { isDemoMode } from '@/lib/demo'
import { DashboardSidebar } from './DashboardSidebar'
import { DefaultPasswordBanner } from './DefaultPasswordBanner'
import { Toaster } from 'sonner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId || !session?.user) redirect('/login')

  const [member, currentUser] = await Promise.all([
    prisma.member.findFirst({
      where: { userId, deactivatedAt: null },
      select: { workspaceId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { passwordChangedAt: true, passwordHash: true },
    }),
  ])
  if (!member) redirect('/login')

  const demoMode = isDemoMode()
  // Only show banner for seeded credentials users who never changed their password.
  // Invited users set passwordChangedAt on accept; OAuth users have no passwordHash.
  const showDefaultPasswordBanner =
    !demoMode &&
    currentUser?.passwordHash !== null &&
    currentUser?.passwordChangedAt === null

  const workspace = await prisma.workspace.findUnique({
    where: { id: member.workspaceId },
    select: { themeId: true, name: true, logo: true },
  })
  if (!workspace) redirect('/login')

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
          where: { id: member.workspaceId },
          select: { fontPresetId: true },
        })
      : Promise.resolve(null),
    brandTextColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { brandText: true },
        })
      : Promise.resolve(null),
    customCreamColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: member.workspaceId }, select: { customCreamColor: true } })
      : Promise.resolve(null),
    customInkColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: member.workspaceId }, select: { customInkColor: true } })
      : Promise.resolve(null),
    customMutedColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: member.workspaceId }, select: { customMutedColor: true } })
      : Promise.resolve(null),
    customBorderColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: member.workspaceId }, select: { customBorderColor: true } })
      : Promise.resolve(null),
    customAccentColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: member.workspaceId }, select: { customAccentColor: true } })
      : Promise.resolve(null),
    customGreenColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: member.workspaceId }, select: { customGreenColor: true } })
      : Promise.resolve(null),
    customWhiteColorColumnExists
      ? prisma.workspace.findUnique({ where: { id: member.workspaceId }, select: { customWhiteColor: true } })
      : Promise.resolve(null),
    customRadiusColumnExists
      ? prisma.workspace.findUnique({ where: { id: member.workspaceId }, select: { customRadius: true } })
      : Promise.resolve(null),
    customHeadingFontFamilyColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customHeadingFontFamily: true },
        })
      : Promise.resolve(null),
    customHeadingFontUrlColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customHeadingFontUrl: true },
        })
      : Promise.resolve(null),
    customBodyFontFamilyColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customBodyFontFamily: true },
        })
      : Promise.resolve(null),
    customBodyFontUrlColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customBodyFontUrl: true },
        })
      : Promise.resolve(null),
    customBrandFontFamilyColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customBrandFontFamily: true },
        })
      : Promise.resolve(null),
    customBrandFontUrlColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
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

  const themeCSS = getWorkspaceThemeCSS(workspace.themeId, overrides)
  const fontUrls = getWorkspaceFontUrls(workspace.themeId, overrides)
  const userInitial = session.user.name?.[0] ?? session.user.email?.[0] ?? 'U'

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {fontUrls.map((url) => (
        <link key={url} rel="stylesheet" href={url} />
      ))}
      <style dangerouslySetInnerHTML={{ __html: `:root { ${themeCSS} }` }} />
      <div className="h-screen bg-cream flex flex-col overflow-hidden">
        {demoMode && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
            <a
              href="https://github.com/babble-open-source/helpnest"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white border border-border text-ink text-xs font-medium px-2.5 py-1 rounded-full shadow hover:bg-cream transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
            <span className="bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow pointer-events-none">
              DEMO
            </span>
          </div>
        )}
        {showDefaultPasswordBanner && <DefaultPasswordBanner />}
        <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar
          workspaceId={member.workspaceId}
          workspaceName={workspace.name}
          workspaceLogo={workspace.logo}
          workspaceBrandText={brandTextRecord?.brandText ?? null}
          userName={session.user.name ?? 'User'}
          userEmail={session.user.email ?? ''}
          userInitial={userInitial}
        />
        <main className="flex-1 overflow-auto pt-14 lg:pt-0">
          {children}
        </main>
        </div>
      </div>
      <Toaster position="bottom-right" theme="light" />
    </>
  )
}
