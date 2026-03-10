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
      select: { passwordChangedAt: true },
    }),
  ])
  if (!member) redirect('/login')

  const showDefaultPasswordBanner = !isDemoMode() && currentUser?.passwordChangedAt === null

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
        {showDefaultPasswordBanner && <DefaultPasswordBanner />}
        <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar
          workspaceName={workspace.name}
          workspaceLogo={workspace.logo}
          workspaceBrandText={brandTextRecord?.brandText ?? null}
          userName={session.user.name ?? 'User'}
          userEmail={session.user.email ?? ''}
          userInitial={userInitial}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
        </div>
      </div>
    </>
  )
}
