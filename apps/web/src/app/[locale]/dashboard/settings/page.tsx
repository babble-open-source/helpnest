import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { isDemoMode } from '@/lib/demo'
import { fontPresets, radiusOptions } from '@/lib/branding'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { themes } from '@/lib/themes'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AiSettingsSection } from './AiSettingsSection'
import { ApiKeysSection } from './ApiKeysSection'
import { MembersSection } from './MembersSection'
import { ProfileForm } from './ProfileForm'
import { SyncEmbeddingsButton } from './SyncEmbeddingsButton'
import { ThemePicker } from './ThemePicker'
import { WorkspaceForm } from './WorkspaceForm'

export default async function SettingsPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const demoMode = isDemoMode()
  const [session, t] = await Promise.all([auth(), getTranslations('settingsPage')])
  if (!session?.user) redirect('/login')

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect('/login')

  // Parallel: workspace resolution + column set (single schema query, cached for process lifetime)
  const [workspaceId, columns] = await Promise.all([
    resolveWorkspaceId(userId),
    getWorkspaceColumnSet(),
  ])

  if (!workspaceId) redirect('/dashboard')

  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })

  if (!member) redirect('/dashboard')

  // Parallel: single workspace query (all fields in one trip) + team list
  const [workspace, members] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        // Base fields
        name: true,
        slug: true,
        logo: true,
        themeId: true,
        customDomain: true,
        // AI settings
        aiEnabled: true,
        aiProvider: true,
        aiModel: true,
        aiApiKey: true,
        aiGreeting: true,
        aiInstructions: true,
        aiEscalationThreshold: true,
        productContext: true,
        autoDraftGapsEnabled: true,
        autoDraftGapThreshold: true,
        autoDraftExternalEnabled: true,
        batchWindowMinutes: true,
        // Migration-guarded branding fields — only selected when the column exists
        ...(columns.has('fontPresetId') ? { fontPresetId: true } : {}),
        ...(columns.has('brandText') ? { brandText: true } : {}),
        ...(columns.has('favicon') ? { favicon: true } : {}),
        ...(columns.has('metaTitle') ? { metaTitle: true } : {}),
        ...(columns.has('metaDescription') ? { metaDescription: true } : {}),
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
    }),
    prisma.member.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
    }),
  ])

  const serializedMembers = members.map((m) => ({
    ...m,
    deactivatedAt: m.deactivatedAt ? m.deactivatedAt.toISOString() : null,
  }))

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl text-ink mb-8">{t('title')}</h1>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-4">{t('yourProfile')}</h2>
          <ProfileForm name={member.user.name ?? ''} demoMode={demoMode} />
        </div>

        {/* Workspace */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-4">{t('workspace')}</h2>
          <WorkspaceForm
            name={workspace?.name ?? ''}
            slug={workspace?.slug ?? ''}
            customDomain={workspace?.customDomain ?? ''}
            logo={workspace?.logo ?? ''}
            brandText={workspace?.brandText ?? ''}
            customBrandFontFamily={workspace?.customBrandFontFamily ?? ''}
            customBrandFontUrl={workspace?.customBrandFontUrl ?? ''}
            favicon={workspace?.favicon ?? ''}
            metaTitle={workspace?.metaTitle ?? ''}
            metaDescription={workspace?.metaDescription ?? ''}
            appUrl={appUrl}
            helpCenterDomain={process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN ?? ''}
            demoMode={demoMode}
          />
        </div>

        {/* Members */}
        <MembersSection
          members={serializedMembers}
          currentUserId={userId}
          callerRole={member.role}
          demoMode={demoMode}
        />

        {/* Theme */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-1">{t('branding')}</h2>
          <p className="text-sm text-muted mb-4">
            {t('brandingDescription')}
          </p>
          <ThemePicker
            themes={themes}
            fontPresets={fontPresets}
            radiusOptions={radiusOptions}
            currentThemeId={workspace?.themeId ?? ''}
            currentFontPresetId={workspace?.fontPresetId ?? null}
            currentCustomCreamColor={workspace?.customCreamColor ?? ''}
            currentCustomInkColor={workspace?.customInkColor ?? ''}
            currentCustomMutedColor={workspace?.customMutedColor ?? ''}
            currentCustomBorderColor={workspace?.customBorderColor ?? ''}
            currentCustomAccentColor={workspace?.customAccentColor ?? ''}
            currentCustomGreenColor={workspace?.customGreenColor ?? ''}
            currentCustomWhiteColor={workspace?.customWhiteColor ?? ''}
            currentCustomRadius={workspace?.customRadius ?? ''}
            currentCustomHeadingFontFamily={workspace?.customHeadingFontFamily ?? ''}
            currentCustomHeadingFontUrl={workspace?.customHeadingFontUrl ?? ''}
            currentCustomBodyFontFamily={workspace?.customBodyFontFamily ?? ''}
            currentCustomBodyFontUrl={workspace?.customBodyFontUrl ?? ''}
            workspaceSlug={workspace?.slug ?? ''}
            demoMode={demoMode}
          />
        </div>

        {/* AI Agent */}
        <AiSettingsSection
          aiEnabled={workspace?.aiEnabled ?? false}
          aiProvider={workspace?.aiProvider ?? null}
          aiModel={workspace?.aiModel ?? null}
          aiGreeting={workspace?.aiGreeting ?? null}
          aiInstructions={workspace?.aiInstructions ?? null}
          aiEscalationThreshold={workspace?.aiEscalationThreshold ?? 0.3}
          hasApiKey={!!workspace?.aiApiKey}
          demoMode={demoMode}
          productContext={workspace?.productContext ?? null}
          autoDraftGapsEnabled={workspace?.autoDraftGapsEnabled ?? true}
          autoDraftGapThreshold={workspace?.autoDraftGapThreshold ?? 2}
          autoDraftExternalEnabled={workspace?.autoDraftExternalEnabled ?? true}
          batchWindowMinutes={workspace?.batchWindowMinutes ?? 60}
        />

        {/* AI Search */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-1">{t('aiSearch')}</h2>
          <p className="text-sm text-muted mb-4">
            {t('aiSearchDescription')}
          </p>
          <SyncEmbeddingsButton workspaceId={workspaceId} />
        </div>

        {/* API Keys */}
        <ApiKeysSection demoMode={demoMode} />
      </div>
    </div>
  )
}
