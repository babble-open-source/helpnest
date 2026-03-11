import { auth } from '@/lib/auth'
import { isDemoMode } from '@/lib/demo'
import { fontPresets, radiusOptions } from '@/lib/branding'
import {
  hasWorkspaceBrandTextColumn,
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
import { themes } from '@/lib/themes'
import { redirect } from 'next/navigation'
import { ApiKeysSection } from './ApiKeysSection'
import { MembersSection } from './MembersSection'
import { ProfileForm } from './ProfileForm'
import { SyncEmbeddingsButton } from './SyncEmbeddingsButton'
import { ThemePicker } from './ThemePicker'
import { WorkspaceForm } from './WorkspaceForm'

export default async function SettingsPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helpnest.cloud'
  const demoMode = isDemoMode()
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [
    fontPresetColumnExists,
    brandTextColumnExists,
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
    hasWorkspaceBrandTextColumn(),
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
  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: {
      workspaceId: true,
      userId: true,
      role: true,
      user: {
        select: { id: true, name: true, email: true },
      },
      workspace: {
        select: {
          name: true,
          slug: true,
          customDomain: true,
          logo: true,
          themeId: true,
        },
      },
    },
  })
  if (!member) redirect('/dashboard')

  const [
    workspaceFontPreset,
    workspaceBrandText,
    workspaceFavicon,
    workspaceMetaTitle,
    workspaceMetaDescription,
    workspaceCustomCreamColor,
    workspaceCustomInkColor,
    workspaceCustomMutedColor,
    workspaceCustomBorderColor,
    workspaceCustomAccentColor,
    workspaceCustomGreenColor,
    workspaceCustomWhiteColor,
    workspaceCustomRadius,
    workspaceCustomHeadingFontFamily,
    workspaceCustomHeadingFontUrl,
    workspaceCustomBodyFontFamily,
    workspaceCustomBodyFontUrl,
    workspaceCustomBrandFontFamily,
    workspaceCustomBrandFontUrl,
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
    faviconColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { favicon: true },
        })
      : Promise.resolve(null),
    metaTitleColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { metaTitle: true },
        })
      : Promise.resolve(null),
    metaDescriptionColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { metaDescription: true },
        })
      : Promise.resolve(null),
    customCreamColorColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customCreamColor: true },
        })
      : Promise.resolve(null),
    customInkColorColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customInkColor: true },
        })
      : Promise.resolve(null),
    customMutedColorColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customMutedColor: true },
        })
      : Promise.resolve(null),
    customBorderColorColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customBorderColor: true },
        })
      : Promise.resolve(null),
    customAccentColorColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customAccentColor: true },
        })
      : Promise.resolve(null),
    customGreenColorColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customGreenColor: true },
        })
      : Promise.resolve(null),
    customWhiteColorColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customWhiteColor: true },
        })
      : Promise.resolve(null),
    customRadiusColumnExists
      ? prisma.workspace.findUnique({
          where: { id: member.workspaceId },
          select: { customRadius: true },
        })
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

  const members = await prisma.member.findMany({
    where: { workspaceId: member.workspaceId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
  })

  // Serialize deactivatedAt to string so the client component receives a plain object
  const serializedMembers = members.map((m) => ({
    ...m,
    deactivatedAt: m.deactivatedAt ? m.deactivatedAt.toISOString() : null,
  }))

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl text-ink mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-4">Your profile</h2>
          <ProfileForm name={member.user.name ?? ''} demoMode={demoMode} />
        </div>

        {/* Workspace */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-4">Workspace</h2>
          <WorkspaceForm
            name={member.workspace.name}
            slug={member.workspace.slug}
            customDomain={member.workspace.customDomain ?? ''}
            logo={member.workspace.logo ?? ''}
            brandText={workspaceBrandText?.brandText ?? ''}
            customBrandFontFamily={workspaceCustomBrandFontFamily?.customBrandFontFamily ?? ''}
            customBrandFontUrl={workspaceCustomBrandFontUrl?.customBrandFontUrl ?? ''}
            favicon={workspaceFavicon?.favicon ?? ''}
            metaTitle={workspaceMetaTitle?.metaTitle ?? ''}
            metaDescription={workspaceMetaDescription?.metaDescription ?? ''}
            appUrl={appUrl}
            demoMode={demoMode}
          />
        </div>

        {/* Members */}
        <MembersSection
          members={serializedMembers}
          currentUserId={member.userId}
          callerRole={member.role}
          demoMode={demoMode}
        />

        {/* Theme */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-1">Branding</h2>
          <p className="text-sm text-muted mb-4">
            Set the look and feel for your help center with a theme and company font pair.
          </p>
          <ThemePicker
            themes={themes}
            fontPresets={fontPresets}
            radiusOptions={radiusOptions}
            currentThemeId={member.workspace.themeId}
            currentFontPresetId={workspaceFontPreset?.fontPresetId ?? null}
            currentCustomCreamColor={workspaceCustomCreamColor?.customCreamColor ?? ''}
            currentCustomInkColor={workspaceCustomInkColor?.customInkColor ?? ''}
            currentCustomMutedColor={workspaceCustomMutedColor?.customMutedColor ?? ''}
            currentCustomBorderColor={workspaceCustomBorderColor?.customBorderColor ?? ''}
            currentCustomAccentColor={workspaceCustomAccentColor?.customAccentColor ?? ''}
            currentCustomGreenColor={workspaceCustomGreenColor?.customGreenColor ?? ''}
            currentCustomWhiteColor={workspaceCustomWhiteColor?.customWhiteColor ?? ''}
            currentCustomRadius={workspaceCustomRadius?.customRadius ?? ''}
            currentCustomHeadingFontFamily={workspaceCustomHeadingFontFamily?.customHeadingFontFamily ?? ''}
            currentCustomHeadingFontUrl={workspaceCustomHeadingFontUrl?.customHeadingFontUrl ?? ''}
            currentCustomBodyFontFamily={workspaceCustomBodyFontFamily?.customBodyFontFamily ?? ''}
            currentCustomBodyFontUrl={workspaceCustomBodyFontUrl?.customBodyFontUrl ?? ''}
            workspaceSlug={member.workspace.slug}
            demoMode={demoMode}
          />
        </div>

        {/* AI Search */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-1">AI Search</h2>
          <p className="text-sm text-muted mb-4">
            Index your articles for AI-powered search. Requires OpenAI API key and Qdrant.
          </p>
          <SyncEmbeddingsButton workspaceId={member.workspaceId} />
        </div>

        {/* API Keys */}
        <ApiKeysSection demoMode={demoMode} />
      </div>
    </div>
  )
}
