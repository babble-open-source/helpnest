import { auth, resolveSessionUserId } from '@/lib/auth'
import { kvPutDomain } from '@/lib/cloudflare-kv'
import { getFontPreset, radiusOptions } from '@/lib/branding'
import { encryptApiKey } from '@/lib/ai/resolve-provider'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { Prisma } from '@helpnest/db'
import { themes } from '@/lib/themes'
import { isDemoMode } from '@/lib/demo'
import { resolveWorkspaceId } from '@/lib/workspace'
import { NextResponse } from 'next/server'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function isValidLogoUrl(value: string): boolean {
  if (value.startsWith('/')) return true
  if (value.startsWith('data:image/')) return true

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

import { isAllowedFontUrl } from '@/lib/font-url'

function isValidFontUrl(value: string): boolean {
  return isAllowedFontUrl(value)
}

export async function PATCH(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const {
    name,
    slug,
    // customDomain removed — must go through /api/domains/register for validation
    themeId,
    logo,
    brandText,
    favicon,
    metaTitle,
    metaDescription,
    fontPresetId,
    customCreamColor,
    customInkColor,
    customMutedColor,
    customBorderColor,
    customAccentColor,
    customGreenColor,
    customWhiteColor,
    customRadius,
    customHeadingFontFamily,
    customHeadingFontUrl,
    customBodyFontFamily,
    customBodyFontUrl,
    customBrandFontFamily,
    customBrandFontUrl,
    aiEnabled,
    aiProvider,
    aiModel,
    aiApiKey,
    aiGreeting,
    aiInstructions,
    aiEscalationThreshold,
    productContext,
    autoDraftGapsEnabled,
    autoDraftGapThreshold,
    autoDraftExternalEnabled,
    batchWindowMinutes,
    aiDraftRateLimit,
  } = body as {
    name?: unknown
    slug?: unknown
    themeId?: unknown
    logo?: unknown
    brandText?: unknown
    favicon?: unknown
    metaTitle?: unknown
    metaDescription?: unknown
    fontPresetId?: unknown
    customCreamColor?: unknown
    customInkColor?: unknown
    customMutedColor?: unknown
    customBorderColor?: unknown
    customAccentColor?: unknown
    customGreenColor?: unknown
    customWhiteColor?: unknown
    customRadius?: unknown
    customHeadingFontFamily?: unknown
    customHeadingFontUrl?: unknown
    customBodyFontFamily?: unknown
    customBodyFontUrl?: unknown
    customBrandFontFamily?: unknown
    customBrandFontUrl?: unknown
    aiEnabled?: unknown
    aiProvider?: unknown
    aiModel?: unknown
    aiApiKey?: unknown
    aiGreeting?: unknown
    aiInstructions?: unknown
    aiEscalationThreshold?: unknown
    productContext?: unknown
    autoDraftGapsEnabled?: unknown
    autoDraftGapThreshold?: unknown
    autoDraftExternalEnabled?: unknown
    batchWindowMinutes?: unknown
    aiDraftRateLimit?: unknown
  }

  if (isDemoMode()) {
    return NextResponse.json({ error: 'Workspace settings cannot be changed in demo mode.' }, { status: 403 })
  }

  // Resolve the active workspace (respects the helpnest-workspace cookie, same
  // as the settings page) so we always update the workspace the user is viewing.
  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Authorise early — must be OWNER or ADMIN before any validation or DB reads
  const member = await prisma.member.findFirst({
    where: { userId, workspaceId, deactivatedAt: null, role: { in: ['OWNER', 'ADMIN'] } },
    select: { workspaceId: true },
  })
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 })
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 })
    }
  }

  if (slug !== undefined) {
    if (typeof slug !== 'string' || !SLUG_RE.test(slug) || slug.length > 63) {
      return NextResponse.json(
        { error: 'Slug must be lowercase alphanumeric with hyphens, max 63 characters' },
        { status: 400 },
      )
    }
  }

  if (logo !== undefined && logo !== null) {
    if (typeof logo !== 'string') {
      return NextResponse.json({ error: 'Logo must be a string' }, { status: 400 })
    }

    const trimmedLogo = logo.trim()
    if (trimmedLogo.length > 2048) {
      return NextResponse.json({ error: 'Logo URL must be 2048 characters or fewer' }, { status: 400 })
    }
    if (trimmedLogo.length > 0 && !isValidLogoUrl(trimmedLogo)) {
      return NextResponse.json(
        { error: 'Logo must be an absolute URL, root-relative path, or data image' },
        { status: 400 },
      )
    }
  }

  if (brandText !== undefined && brandText !== null) {
    if (typeof brandText !== 'string') {
      return NextResponse.json({ error: 'Brand wordmark must be a string' }, { status: 400 })
    }
    if (brandText.trim().length > 120) {
      return NextResponse.json({ error: 'Brand wordmark must be 120 characters or fewer' }, { status: 400 })
    }
  }

  if (favicon !== undefined && favicon !== null) {
    if (typeof favicon !== 'string') {
      return NextResponse.json({ error: 'Favicon must be a string' }, { status: 400 })
    }

    const trimmedFavicon = favicon.trim()
    if (trimmedFavicon.length > 2048) {
      return NextResponse.json({ error: 'Favicon URL must be 2048 characters or fewer' }, { status: 400 })
    }
    if (trimmedFavicon.length > 0 && !isValidLogoUrl(trimmedFavicon)) {
      return NextResponse.json(
        { error: 'Favicon must be an absolute URL, root-relative path, or data image' },
        { status: 400 },
      )
    }
  }

  if (metaTitle !== undefined && metaTitle !== null) {
    if (typeof metaTitle !== 'string') {
      return NextResponse.json({ error: 'Meta title must be a string' }, { status: 400 })
    }
    if (metaTitle.trim().length > 120) {
      return NextResponse.json({ error: 'Meta title must be 120 characters or fewer' }, { status: 400 })
    }
  }

  if (metaDescription !== undefined && metaDescription !== null) {
    if (typeof metaDescription !== 'string') {
      return NextResponse.json({ error: 'Meta description must be a string' }, { status: 400 })
    }
    if (metaDescription.trim().length > 320) {
      return NextResponse.json({ error: 'Meta description must be 320 characters or fewer' }, { status: 400 })
    }
  }

  if (themeId !== undefined && typeof themeId === 'string') {
    if (!themes.find((t) => t.id === themeId)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }
  } else if (themeId !== undefined) {
    return NextResponse.json({ error: 'Theme must be a string' }, { status: 400 })
  }

  if (fontPresetId !== undefined && fontPresetId !== null) {
    if (typeof fontPresetId !== 'string') {
      return NextResponse.json({ error: 'Font preset must be a string' }, { status: 400 })
    }
    if (fontPresetId.length > 0 && !getFontPreset(fontPresetId)) {
      return NextResponse.json({ error: 'Invalid font preset' }, { status: 400 })
    }
  }

  for (const [label, value] of [
    ['Background color', customCreamColor],
    ['Text color', customInkColor],
    ['Muted color', customMutedColor],
    ['Border color', customBorderColor],
    ['Accent color', customAccentColor],
    ['Success color', customGreenColor],
    ['Surface color', customWhiteColor],
  ] as const) {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        return NextResponse.json({ error: `${label} must be a string` }, { status: 400 })
      }
      const trimmedColor = value.trim()
      if (trimmedColor.length > 0 && !HEX_COLOR_RE.test(trimmedColor)) {
        return NextResponse.json({ error: `${label} must be a valid hex color` }, { status: 400 })
      }
    }
  }

  if (customRadius !== undefined && customRadius !== null) {
    if (typeof customRadius !== 'string') {
      return NextResponse.json({ error: 'Radius must be a string' }, { status: 400 })
    }
    if (customRadius.length > 0 && !radiusOptions.includes(customRadius as (typeof radiusOptions)[number])) {
      return NextResponse.json({ error: 'Radius must be one of none, sm, md, lg, or xl' }, { status: 400 })
    }
  }

  for (const [label, value] of [
    ['Heading font family', customHeadingFontFamily],
    ['Body font family', customBodyFontFamily],
    ['Brand font family', customBrandFontFamily],
  ] as const) {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        return NextResponse.json({ error: `${label} must be a string` }, { status: 400 })
      }
      if (value.trim().length > 200) {
        return NextResponse.json({ error: `${label} must be 200 characters or fewer` }, { status: 400 })
      }
    }
  }

  for (const [label, value] of [
    ['Heading font URL', customHeadingFontUrl],
    ['Body font URL', customBodyFontUrl],
    ['Brand font URL', customBrandFontUrl],
  ] as const) {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        return NextResponse.json({ error: `${label} must be a string` }, { status: 400 })
      }
      const trimmedUrl = value.trim()
      if (trimmedUrl.length > 2048) {
        return NextResponse.json({ error: `${label} must be 2048 characters or fewer` }, { status: 400 })
      }
      if (trimmedUrl.length > 0 && !isValidFontUrl(trimmedUrl)) {
        return NextResponse.json({ error: `${label} must be an HTTPS URL from a supported font provider (Google Fonts, Bunny Fonts, Typekit, cdnfonts)` }, { status: 400 })
      }
    }
  }

  const trimmedCustomHeadingFontFamily =
    typeof customHeadingFontFamily === 'string' && customHeadingFontFamily.trim().length > 0
      ? customHeadingFontFamily.trim()
      : null
  const trimmedCustomHeadingFontUrl =
    typeof customHeadingFontUrl === 'string' && customHeadingFontUrl.trim().length > 0
      ? customHeadingFontUrl.trim()
      : null
  const trimmedCustomBodyFontFamily =
    typeof customBodyFontFamily === 'string' && customBodyFontFamily.trim().length > 0
      ? customBodyFontFamily.trim()
      : null
  const trimmedCustomBodyFontUrl =
    typeof customBodyFontUrl === 'string' && customBodyFontUrl.trim().length > 0
      ? customBodyFontUrl.trim()
      : null
  const trimmedCustomBrandFontFamily =
    typeof customBrandFontFamily === 'string' && customBrandFontFamily.trim().length > 0
      ? customBrandFontFamily.trim()
      : null
  const trimmedCustomBrandFontUrl =
    typeof customBrandFontUrl === 'string' && customBrandFontUrl.trim().length > 0
      ? customBrandFontUrl.trim()
      : null
  const trimmedBrandText =
    typeof brandText === 'string' && brandText.trim().length > 0
      ? brandText.trim()
      : null
  const trimmedFavicon =
    typeof favicon === 'string' && favicon.trim().length > 0
      ? favicon.trim()
      : null
  const trimmedMetaTitle =
    typeof metaTitle === 'string' && metaTitle.trim().length > 0
      ? metaTitle.trim()
      : null
  const trimmedMetaDescription =
    typeof metaDescription === 'string' && metaDescription.trim().length > 0
      ? metaDescription.trim()
      : null
  const trimmedCustomCreamColor =
    typeof customCreamColor === 'string' && customCreamColor.trim().length > 0 ? customCreamColor.trim() : null
  const trimmedCustomInkColor =
    typeof customInkColor === 'string' && customInkColor.trim().length > 0 ? customInkColor.trim() : null
  const trimmedCustomMutedColor =
    typeof customMutedColor === 'string' && customMutedColor.trim().length > 0 ? customMutedColor.trim() : null
  const trimmedCustomBorderColor =
    typeof customBorderColor === 'string' && customBorderColor.trim().length > 0 ? customBorderColor.trim() : null
  const trimmedCustomAccentColor =
    typeof customAccentColor === 'string' && customAccentColor.trim().length > 0 ? customAccentColor.trim() : null
  const trimmedCustomGreenColor =
    typeof customGreenColor === 'string' && customGreenColor.trim().length > 0 ? customGreenColor.trim() : null
  const trimmedCustomWhiteColor =
    typeof customWhiteColor === 'string' && customWhiteColor.trim().length > 0 ? customWhiteColor.trim() : null
  const trimmedCustomRadius =
    typeof customRadius === 'string' && customRadius.trim().length > 0 ? customRadius.trim() : null

  if (trimmedCustomHeadingFontUrl && !trimmedCustomHeadingFontFamily) {
    return NextResponse.json(
      { error: 'Heading font family is required when a heading stylesheet URL is provided' },
      { status: 400 },
    )
  }
  if (trimmedCustomBodyFontUrl && !trimmedCustomBodyFontFamily) {
    return NextResponse.json(
      { error: 'Body font family is required when a body stylesheet URL is provided' },
      { status: 400 },
    )
  }
  if (trimmedCustomBrandFontUrl && !trimmedCustomBrandFontFamily) {
    return NextResponse.json(
      { error: 'Brand font family is required when a brand stylesheet URL is provided' },
      { status: 400 },
    )
  }

  // AI field validation
  const AI_PROVIDERS = ['anthropic', 'openai', 'google', 'mistral'] as const
  type LowercaseAiProvider = (typeof AI_PROVIDERS)[number]
  const AI_PROVIDER_ENUM_MAP: Record<LowercaseAiProvider, 'ANTHROPIC' | 'OPENAI' | 'GOOGLE' | 'MISTRAL'> = {
    anthropic: 'ANTHROPIC',
    openai: 'OPENAI',
    google: 'GOOGLE',
    mistral: 'MISTRAL',
  }

  if (aiEnabled !== undefined && typeof aiEnabled !== 'boolean') {
    return NextResponse.json({ error: 'aiEnabled must be a boolean' }, { status: 400 })
  }

  if (aiProvider !== undefined && aiProvider !== null) {
    if (typeof aiProvider !== 'string' || !AI_PROVIDERS.includes(aiProvider.toLowerCase() as LowercaseAiProvider)) {
      return NextResponse.json(
        { error: 'aiProvider must be one of: anthropic, openai, google, mistral' },
        { status: 400 },
      )
    }
  }

  if (aiModel !== undefined && aiModel !== null) {
    if (typeof aiModel !== 'string') {
      return NextResponse.json({ error: 'aiModel must be a string' }, { status: 400 })
    }
    if (aiModel.trim().length > 120) {
      return NextResponse.json({ error: 'aiModel must be 120 characters or fewer' }, { status: 400 })
    }
  }

  if (aiApiKey !== undefined && aiApiKey !== null) {
    if (typeof aiApiKey !== 'string' || aiApiKey.trim().length === 0) {
      return NextResponse.json({ error: 'aiApiKey must be a non-empty string' }, { status: 400 })
    }
  }

  if (aiGreeting !== undefined && aiGreeting !== null) {
    if (typeof aiGreeting !== 'string') {
      return NextResponse.json({ error: 'aiGreeting must be a string' }, { status: 400 })
    }
    if (aiGreeting.trim().length > 500) {
      return NextResponse.json({ error: 'aiGreeting must be 500 characters or fewer' }, { status: 400 })
    }
  }

  if (aiInstructions !== undefined && aiInstructions !== null) {
    if (typeof aiInstructions !== 'string') {
      return NextResponse.json({ error: 'aiInstructions must be a string' }, { status: 400 })
    }
    if (aiInstructions.trim().length > 4000) {
      return NextResponse.json({ error: 'aiInstructions must be 4000 characters or fewer' }, { status: 400 })
    }
  }

  if (aiEscalationThreshold !== undefined) {
    if (typeof aiEscalationThreshold !== 'number' || isNaN(aiEscalationThreshold)) {
      return NextResponse.json({ error: 'aiEscalationThreshold must be a number' }, { status: 400 })
    }
    if (aiEscalationThreshold < 0 || aiEscalationThreshold > 1) {
      return NextResponse.json({ error: 'aiEscalationThreshold must be between 0 and 1' }, { status: 400 })
    }
  }

  if (productContext !== undefined && productContext !== null) {
    if (typeof productContext !== 'string') {
      return NextResponse.json({ error: 'productContext must be a string' }, { status: 400 })
    }
    if (productContext.trim().length > 4000) {
      return NextResponse.json({ error: 'productContext must be 4000 characters or fewer' }, { status: 400 })
    }
  }

  if (autoDraftGapsEnabled !== undefined && typeof autoDraftGapsEnabled !== 'boolean') {
    return NextResponse.json({ error: 'autoDraftGapsEnabled must be a boolean' }, { status: 400 })
  }

  if (autoDraftGapThreshold !== undefined) {
    if (typeof autoDraftGapThreshold !== 'number' || !Number.isInteger(autoDraftGapThreshold) || autoDraftGapThreshold < 1 || autoDraftGapThreshold > 100) {
      return NextResponse.json({ error: 'autoDraftGapThreshold must be an integer between 1 and 100' }, { status: 400 })
    }
  }

  if (autoDraftExternalEnabled !== undefined && typeof autoDraftExternalEnabled !== 'boolean') {
    return NextResponse.json({ error: 'autoDraftExternalEnabled must be a boolean' }, { status: 400 })
  }

  if (batchWindowMinutes !== undefined) {
    if (typeof batchWindowMinutes !== 'number' || !Number.isInteger(batchWindowMinutes) || batchWindowMinutes < 1 || batchWindowMinutes > 1440) {
      return NextResponse.json({ error: 'batchWindowMinutes must be an integer between 1 and 1440' }, { status: 400 })
    }
  }

  if (aiDraftRateLimit !== undefined) {
    if (typeof aiDraftRateLimit !== 'number' || !Number.isInteger(aiDraftRateLimit) || aiDraftRateLimit < 1 || aiDraftRateLimit > 500) {
      return NextResponse.json({ error: 'aiDraftRateLimit must be an integer between 1 and 500' }, { status: 400 })
    }
  }

  const clampedThreshold =
    aiEscalationThreshold !== undefined ? (aiEscalationThreshold as number) : undefined

  const resolvedAiProvider =
    aiProvider !== undefined && aiProvider !== null
      ? AI_PROVIDER_ENUM_MAP[(aiProvider as string).toLowerCase() as LowercaseAiProvider]
      : undefined

  const trimmedAiModel =
    typeof aiModel === 'string' && aiModel.trim().length > 0 ? aiModel.trim() : null
  const trimmedAiGreeting =
    typeof aiGreeting === 'string' && aiGreeting.trim().length > 0 ? aiGreeting.trim() : null
  const trimmedAiInstructions =
    typeof aiInstructions === 'string' && aiInstructions.trim().length > 0 ? aiInstructions.trim() : null
  // null = explicit removal (revert to env vars); string = encrypt and store; undefined = no change
  const encryptedAiApiKey =
    aiApiKey === null
      ? null
      : typeof aiApiKey === 'string' && aiApiKey.trim().length > 0
        ? encryptApiKey(aiApiKey.trim())
        : undefined

  // Single schema introspection query — results are process-lifetime cached.
  // Note: after adding a column via migration, a process restart is required
  // to clear this cache and allow the new column to be persisted.
  const cols = await getWorkspaceColumnSet()

  const canPersistFontPreset = fontPresetId !== undefined && cols.has('fontPresetId')
  const canPersistBrandText = brandText !== undefined && cols.has('brandText')
  const canPersistFavicon = favicon !== undefined && cols.has('favicon')
  const canPersistMetaTitle = metaTitle !== undefined && cols.has('metaTitle')
  const canPersistMetaDescription = metaDescription !== undefined && cols.has('metaDescription')
  const canPersistCustomCreamColor = customCreamColor !== undefined && cols.has('customCreamColor')
  const canPersistCustomInkColor = customInkColor !== undefined && cols.has('customInkColor')
  const canPersistCustomMutedColor = customMutedColor !== undefined && cols.has('customMutedColor')
  const canPersistCustomBorderColor = customBorderColor !== undefined && cols.has('customBorderColor')
  const canPersistCustomAccentColor = customAccentColor !== undefined && cols.has('customAccentColor')
  const canPersistCustomGreenColor = customGreenColor !== undefined && cols.has('customGreenColor')
  const canPersistCustomWhiteColor = customWhiteColor !== undefined && cols.has('customWhiteColor')
  const canPersistCustomRadius = customRadius !== undefined && cols.has('customRadius')
  const canPersistCustomHeadingFontFamily = customHeadingFontFamily !== undefined && cols.has('customHeadingFontFamily')
  const canPersistCustomHeadingFontUrl = customHeadingFontUrl !== undefined && cols.has('customHeadingFontUrl')
  const canPersistCustomBodyFontFamily = customBodyFontFamily !== undefined && cols.has('customBodyFontFamily')
  const canPersistCustomBodyFontUrl = customBodyFontUrl !== undefined && cols.has('customBodyFontUrl')
  const canPersistCustomBrandFontFamily = customBrandFontFamily !== undefined && cols.has('customBrandFontFamily')
  const canPersistCustomBrandFontUrl = customBrandFontUrl !== undefined && cols.has('customBrandFontUrl')
  const trimmedProductContext =
    typeof productContext === 'string' && productContext.trim().length > 0
      ? productContext.trim()
      : null
  const canPersistProductContext = productContext !== undefined && cols.has('productContext')
  const canPersistAutoDraftGapsEnabled = autoDraftGapsEnabled !== undefined && cols.has('autoDraftGapsEnabled')
  const canPersistAutoDraftGapThreshold = autoDraftGapThreshold !== undefined && cols.has('autoDraftGapThreshold')
  const canPersistAutoDraftExternalEnabled = autoDraftExternalEnabled !== undefined && cols.has('autoDraftExternalEnabled')
  const canPersistBatchWindowMinutes = batchWindowMinutes !== undefined && cols.has('batchWindowMinutes')
  const canPersistAiDraftRateLimit = aiDraftRateLimit !== undefined && cols.has('aiDraftRateLimit')

  // 409 only when the client is trying to SET a non-empty value for a column that
  // doesn't exist yet (migration pending). Sending null/empty to clear a missing
  // column is harmless — we just skip persisting it — so no error is raised.
  if (typeof fontPresetId === 'string' && fontPresetId.length > 0 && !canPersistFontPreset) {
    return NextResponse.json(
      { error: 'Font presets require the latest database migration.' },
      { status: 409 },
    )
  }
  if (
    (typeof brandText === 'string' && brandText.trim().length > 0 && !canPersistBrandText) ||
    (typeof favicon === 'string' && favicon.trim().length > 0 && !canPersistFavicon) ||
    (typeof metaTitle === 'string' && metaTitle.trim().length > 0 && !canPersistMetaTitle) ||
    (typeof metaDescription === 'string' && metaDescription.trim().length > 0 && !canPersistMetaDescription)
  ) {
    return NextResponse.json(
      { error: 'Workspace identity branding requires the latest database migration.' },
      { status: 409 },
    )
  }
  if (
    (typeof customCreamColor === 'string' && customCreamColor.trim().length > 0 && !canPersistCustomCreamColor) ||
    (typeof customInkColor === 'string' && customInkColor.trim().length > 0 && !canPersistCustomInkColor) ||
    (typeof customMutedColor === 'string' && customMutedColor.trim().length > 0 && !canPersistCustomMutedColor) ||
    (typeof customBorderColor === 'string' && customBorderColor.trim().length > 0 && !canPersistCustomBorderColor) ||
    (typeof customAccentColor === 'string' && customAccentColor.trim().length > 0 && !canPersistCustomAccentColor) ||
    (typeof customGreenColor === 'string' && customGreenColor.trim().length > 0 && !canPersistCustomGreenColor) ||
    (typeof customWhiteColor === 'string' && customWhiteColor.trim().length > 0 && !canPersistCustomWhiteColor) ||
    (typeof customRadius === 'string' && customRadius.trim().length > 0 && !canPersistCustomRadius)
  ) {
    return NextResponse.json(
      { error: 'Custom theme overrides require the latest database migration.' },
      { status: 409 },
    )
  }
  if (
    (typeof customHeadingFontFamily === 'string' && customHeadingFontFamily.trim().length > 0 && !canPersistCustomHeadingFontFamily) ||
    (typeof customHeadingFontUrl === 'string' && customHeadingFontUrl.trim().length > 0 && !canPersistCustomHeadingFontUrl) ||
    (typeof customBodyFontFamily === 'string' && customBodyFontFamily.trim().length > 0 && !canPersistCustomBodyFontFamily) ||
    (typeof customBodyFontUrl === 'string' && customBodyFontUrl.trim().length > 0 && !canPersistCustomBodyFontUrl) ||
    (typeof customBrandFontFamily === 'string' && customBrandFontFamily.trim().length > 0 && !canPersistCustomBrandFontFamily) ||
    (typeof customBrandFontUrl === 'string' && customBrandFontUrl.trim().length > 0 && !canPersistCustomBrandFontUrl)
  ) {
    return NextResponse.json(
      { error: 'Brand and content font overrides require the latest database migration.' },
      { status: 409 },
    )
  }

  if (typeof aiDraftRateLimit === 'number' && !canPersistAiDraftRateLimit) {
    return NextResponse.json(
      { error: 'AI draft rate limit requires the latest database migration.' },
      { status: 409 },
    )
  }

  try {
    const trimmedLogo =
      typeof logo === 'string' && logo.trim().length > 0
        ? logo.trim()
        : null

    const updated = await prisma.workspace.update({
      where: { id: member.workspaceId },
      data: {
        ...(name ? { name: (name as string).trim() } : {}),
        ...(slug ? { slug: slug as string } : {}),
        ...(logo !== undefined ? { logo: trimmedLogo } : {}),
        ...(canPersistBrandText ? { brandText: trimmedBrandText } : {}),
        ...(canPersistFavicon ? { favicon: trimmedFavicon } : {}),
        ...(canPersistMetaTitle ? { metaTitle: trimmedMetaTitle } : {}),
        ...(canPersistMetaDescription ? { metaDescription: trimmedMetaDescription } : {}),
        ...(themeId ? { themeId: themeId as string } : {}),
        ...(canPersistFontPreset
          ? { fontPresetId: typeof fontPresetId === 'string' && fontPresetId.length > 0 ? fontPresetId : null }
          : {}),
        ...(canPersistCustomCreamColor ? { customCreamColor: trimmedCustomCreamColor } : {}),
        ...(canPersistCustomInkColor ? { customInkColor: trimmedCustomInkColor } : {}),
        ...(canPersistCustomMutedColor ? { customMutedColor: trimmedCustomMutedColor } : {}),
        ...(canPersistCustomBorderColor ? { customBorderColor: trimmedCustomBorderColor } : {}),
        ...(canPersistCustomAccentColor ? { customAccentColor: trimmedCustomAccentColor } : {}),
        ...(canPersistCustomGreenColor ? { customGreenColor: trimmedCustomGreenColor } : {}),
        ...(canPersistCustomWhiteColor ? { customWhiteColor: trimmedCustomWhiteColor } : {}),
        ...(canPersistCustomRadius ? { customRadius: trimmedCustomRadius } : {}),
        ...(canPersistCustomHeadingFontFamily ? { customHeadingFontFamily: trimmedCustomHeadingFontFamily } : {}),
        ...(canPersistCustomHeadingFontUrl ? { customHeadingFontUrl: trimmedCustomHeadingFontUrl } : {}),
        ...(canPersistCustomBodyFontFamily ? { customBodyFontFamily: trimmedCustomBodyFontFamily } : {}),
        ...(canPersistCustomBodyFontUrl ? { customBodyFontUrl: trimmedCustomBodyFontUrl } : {}),
        ...(canPersistCustomBrandFontFamily ? { customBrandFontFamily: trimmedCustomBrandFontFamily } : {}),
        ...(canPersistCustomBrandFontUrl ? { customBrandFontUrl: trimmedCustomBrandFontUrl } : {}),
        ...(aiEnabled !== undefined ? { aiEnabled: aiEnabled as boolean } : {}),
        ...(resolvedAiProvider !== undefined ? { aiProvider: resolvedAiProvider } : {}),
        ...(aiModel !== undefined ? { aiModel: trimmedAiModel } : {}),
        ...(encryptedAiApiKey !== undefined ? { aiApiKey: encryptedAiApiKey } : {}),
        ...(aiGreeting !== undefined ? { aiGreeting: trimmedAiGreeting } : {}),
        ...(aiInstructions !== undefined ? { aiInstructions: trimmedAiInstructions } : {}),
        ...(clampedThreshold !== undefined ? { aiEscalationThreshold: clampedThreshold } : {}),
        ...(canPersistProductContext ? { productContext: trimmedProductContext } : {}),
        ...(canPersistAutoDraftGapsEnabled ? { autoDraftGapsEnabled: autoDraftGapsEnabled as boolean } : {}),
        ...(canPersistAutoDraftGapThreshold ? { autoDraftGapThreshold: autoDraftGapThreshold as number } : {}),
        ...(canPersistAutoDraftExternalEnabled ? { autoDraftExternalEnabled: autoDraftExternalEnabled as boolean } : {}),
        ...(canPersistBatchWindowMinutes ? { batchWindowMinutes: batchWindowMinutes as number } : {}),
        ...(canPersistAiDraftRateLimit ? { aiDraftRateLimit: aiDraftRateLimit as number } : {}),
      },
    })
    // If the slug changed and the workspace has a custom domain, refresh the KV
    // mapping so the Cloudflare Worker routes to the new slug immediately.
    if (slug !== undefined && updated.customDomain) {
      kvPutDomain(updated.customDomain as string, updated.slug as string).catch(() => {})
    }
    // Exclude aiApiKey from the response — the ciphertext has no client use
    // and if encryption is not configured the plaintext would be echoed back.
    const { aiApiKey: _omit, ...safeWorkspace } = updated as typeof updated & { aiApiKey?: unknown }
    void _omit
    return NextResponse.json(safeWorkspace)
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'This slug is already taken' }, { status: 409 })
    }
    throw e
  }
}
