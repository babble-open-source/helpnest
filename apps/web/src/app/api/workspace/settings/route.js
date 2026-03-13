import { auth, resolveSessionUserId } from '@/lib/auth';
import { getFontPreset, radiusOptions } from '@/lib/branding';
import { encryptApiKey } from '@/lib/ai/resolve-provider';
import { hasWorkspaceBrandTextColumn, hasWorkspaceFaviconColumn, hasWorkspaceCustomAccentColorColumn, hasWorkspaceCustomBrandFontFamilyColumn, hasWorkspaceCustomBrandFontUrlColumn, hasWorkspaceCustomBodyFontFamilyColumn, hasWorkspaceCustomBodyFontUrlColumn, hasWorkspaceCustomBorderColorColumn, hasWorkspaceCustomCreamColorColumn, hasWorkspaceCustomGreenColorColumn, hasWorkspaceCustomHeadingFontFamilyColumn, hasWorkspaceCustomHeadingFontUrlColumn, hasWorkspaceCustomInkColorColumn, hasWorkspaceCustomMutedColorColumn, hasWorkspaceCustomRadiusColumn, hasWorkspaceCustomWhiteColorColumn, hasWorkspaceFontPresetColumn, hasWorkspaceMetaDescriptionColumn, hasWorkspaceMetaTitleColumn, hasWorkspaceProductContextColumn, hasWorkspaceAutoDraftGapsEnabledColumn, hasWorkspaceAutoDraftExternalEnabledColumn, prisma, } from '@/lib/db';
import { Prisma } from '@helpnest/db';
import { themes } from '@/lib/themes';
import { isDemoMode } from '@/lib/demo';
import { NextResponse } from 'next/server';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function isValidLogoUrl(value) {
    if (value.startsWith('/'))
        return true;
    if (value.startsWith('data:image/'))
        return true;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function isValidFontUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
export async function PATCH(request) {
    const session = await auth();
    const userId = await resolveSessionUserId(session);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let body;
    try {
        body = await request.json();
    }
    catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { name, slug, customDomain, themeId, logo, brandText, favicon, metaTitle, metaDescription, fontPresetId, customCreamColor, customInkColor, customMutedColor, customBorderColor, customAccentColor, customGreenColor, customWhiteColor, customRadius, customHeadingFontFamily, customHeadingFontUrl, customBodyFontFamily, customBodyFontUrl, customBrandFontFamily, customBrandFontUrl, aiEnabled, aiProvider, aiModel, aiApiKey, aiGreeting, aiInstructions, aiEscalationThreshold, productContext, autoDraftGapsEnabled, autoDraftGapThreshold, autoDraftExternalEnabled, batchWindowMinutes, } = body;
    if (isDemoMode()) {
        return NextResponse.json({ error: 'Workspace settings cannot be changed in demo mode.' }, { status: 403 });
    }
    if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
        }
        if (name.trim().length > 100) {
            return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 });
        }
    }
    if (slug !== undefined) {
        if (typeof slug !== 'string' || !SLUG_RE.test(slug) || slug.length > 63) {
            return NextResponse.json({ error: 'Slug must be lowercase alphanumeric with hyphens, max 63 characters' }, { status: 400 });
        }
    }
    if (customDomain !== undefined && customDomain !== null) {
        if (typeof customDomain !== 'string') {
            return NextResponse.json({ error: 'Custom domain must be a string' }, { status: 400 });
        }
    }
    if (logo !== undefined && logo !== null) {
        if (typeof logo !== 'string') {
            return NextResponse.json({ error: 'Logo must be a string' }, { status: 400 });
        }
        const trimmedLogo = logo.trim();
        if (trimmedLogo.length > 2048) {
            return NextResponse.json({ error: 'Logo URL must be 2048 characters or fewer' }, { status: 400 });
        }
        if (trimmedLogo.length > 0 && !isValidLogoUrl(trimmedLogo)) {
            return NextResponse.json({ error: 'Logo must be an absolute URL, root-relative path, or data image' }, { status: 400 });
        }
    }
    if (brandText !== undefined && brandText !== null) {
        if (typeof brandText !== 'string') {
            return NextResponse.json({ error: 'Brand wordmark must be a string' }, { status: 400 });
        }
        if (brandText.trim().length > 120) {
            return NextResponse.json({ error: 'Brand wordmark must be 120 characters or fewer' }, { status: 400 });
        }
    }
    if (favicon !== undefined && favicon !== null) {
        if (typeof favicon !== 'string') {
            return NextResponse.json({ error: 'Favicon must be a string' }, { status: 400 });
        }
        const trimmedFavicon = favicon.trim();
        if (trimmedFavicon.length > 2048) {
            return NextResponse.json({ error: 'Favicon URL must be 2048 characters or fewer' }, { status: 400 });
        }
        if (trimmedFavicon.length > 0 && !isValidLogoUrl(trimmedFavicon)) {
            return NextResponse.json({ error: 'Favicon must be an absolute URL, root-relative path, or data image' }, { status: 400 });
        }
    }
    if (metaTitle !== undefined && metaTitle !== null) {
        if (typeof metaTitle !== 'string') {
            return NextResponse.json({ error: 'Meta title must be a string' }, { status: 400 });
        }
        if (metaTitle.trim().length > 120) {
            return NextResponse.json({ error: 'Meta title must be 120 characters or fewer' }, { status: 400 });
        }
    }
    if (metaDescription !== undefined && metaDescription !== null) {
        if (typeof metaDescription !== 'string') {
            return NextResponse.json({ error: 'Meta description must be a string' }, { status: 400 });
        }
        if (metaDescription.trim().length > 320) {
            return NextResponse.json({ error: 'Meta description must be 320 characters or fewer' }, { status: 400 });
        }
    }
    if (themeId !== undefined && typeof themeId === 'string') {
        if (!themes.find((t) => t.id === themeId)) {
            return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
        }
    }
    else if (themeId !== undefined) {
        return NextResponse.json({ error: 'Theme must be a string' }, { status: 400 });
    }
    if (fontPresetId !== undefined && fontPresetId !== null) {
        if (typeof fontPresetId !== 'string') {
            return NextResponse.json({ error: 'Font preset must be a string' }, { status: 400 });
        }
        if (fontPresetId.length > 0 && !getFontPreset(fontPresetId)) {
            return NextResponse.json({ error: 'Invalid font preset' }, { status: 400 });
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
    ]) {
        if (value !== undefined && value !== null) {
            if (typeof value !== 'string') {
                return NextResponse.json({ error: `${label} must be a string` }, { status: 400 });
            }
            const trimmedColor = value.trim();
            if (trimmedColor.length > 0 && !HEX_COLOR_RE.test(trimmedColor)) {
                return NextResponse.json({ error: `${label} must be a valid hex color` }, { status: 400 });
            }
        }
    }
    if (customRadius !== undefined && customRadius !== null) {
        if (typeof customRadius !== 'string') {
            return NextResponse.json({ error: 'Radius must be a string' }, { status: 400 });
        }
        if (customRadius.length > 0 && !radiusOptions.includes(customRadius)) {
            return NextResponse.json({ error: 'Radius must be one of none, sm, md, lg, or xl' }, { status: 400 });
        }
    }
    for (const [label, value] of [
        ['Heading font family', customHeadingFontFamily],
        ['Body font family', customBodyFontFamily],
        ['Brand font family', customBrandFontFamily],
    ]) {
        if (value !== undefined && value !== null) {
            if (typeof value !== 'string') {
                return NextResponse.json({ error: `${label} must be a string` }, { status: 400 });
            }
            if (value.trim().length > 200) {
                return NextResponse.json({ error: `${label} must be 200 characters or fewer` }, { status: 400 });
            }
        }
    }
    for (const [label, value] of [
        ['Heading font URL', customHeadingFontUrl],
        ['Body font URL', customBodyFontUrl],
        ['Brand font URL', customBrandFontUrl],
    ]) {
        if (value !== undefined && value !== null) {
            if (typeof value !== 'string') {
                return NextResponse.json({ error: `${label} must be a string` }, { status: 400 });
            }
            const trimmedUrl = value.trim();
            if (trimmedUrl.length > 2048) {
                return NextResponse.json({ error: `${label} must be 2048 characters or fewer` }, { status: 400 });
            }
            if (trimmedUrl.length > 0 && !isValidFontUrl(trimmedUrl)) {
                return NextResponse.json({ error: `${label} must be a valid http or https URL` }, { status: 400 });
            }
        }
    }
    const trimmedCustomHeadingFontFamily = typeof customHeadingFontFamily === 'string' && customHeadingFontFamily.trim().length > 0
        ? customHeadingFontFamily.trim()
        : null;
    const trimmedCustomHeadingFontUrl = typeof customHeadingFontUrl === 'string' && customHeadingFontUrl.trim().length > 0
        ? customHeadingFontUrl.trim()
        : null;
    const trimmedCustomBodyFontFamily = typeof customBodyFontFamily === 'string' && customBodyFontFamily.trim().length > 0
        ? customBodyFontFamily.trim()
        : null;
    const trimmedCustomBodyFontUrl = typeof customBodyFontUrl === 'string' && customBodyFontUrl.trim().length > 0
        ? customBodyFontUrl.trim()
        : null;
    const trimmedCustomBrandFontFamily = typeof customBrandFontFamily === 'string' && customBrandFontFamily.trim().length > 0
        ? customBrandFontFamily.trim()
        : null;
    const trimmedCustomBrandFontUrl = typeof customBrandFontUrl === 'string' && customBrandFontUrl.trim().length > 0
        ? customBrandFontUrl.trim()
        : null;
    const trimmedBrandText = typeof brandText === 'string' && brandText.trim().length > 0
        ? brandText.trim()
        : null;
    const trimmedFavicon = typeof favicon === 'string' && favicon.trim().length > 0
        ? favicon.trim()
        : null;
    const trimmedMetaTitle = typeof metaTitle === 'string' && metaTitle.trim().length > 0
        ? metaTitle.trim()
        : null;
    const trimmedMetaDescription = typeof metaDescription === 'string' && metaDescription.trim().length > 0
        ? metaDescription.trim()
        : null;
    const trimmedCustomCreamColor = typeof customCreamColor === 'string' && customCreamColor.trim().length > 0 ? customCreamColor.trim() : null;
    const trimmedCustomInkColor = typeof customInkColor === 'string' && customInkColor.trim().length > 0 ? customInkColor.trim() : null;
    const trimmedCustomMutedColor = typeof customMutedColor === 'string' && customMutedColor.trim().length > 0 ? customMutedColor.trim() : null;
    const trimmedCustomBorderColor = typeof customBorderColor === 'string' && customBorderColor.trim().length > 0 ? customBorderColor.trim() : null;
    const trimmedCustomAccentColor = typeof customAccentColor === 'string' && customAccentColor.trim().length > 0 ? customAccentColor.trim() : null;
    const trimmedCustomGreenColor = typeof customGreenColor === 'string' && customGreenColor.trim().length > 0 ? customGreenColor.trim() : null;
    const trimmedCustomWhiteColor = typeof customWhiteColor === 'string' && customWhiteColor.trim().length > 0 ? customWhiteColor.trim() : null;
    const trimmedCustomRadius = typeof customRadius === 'string' && customRadius.trim().length > 0 ? customRadius.trim() : null;
    if (trimmedCustomHeadingFontUrl && !trimmedCustomHeadingFontFamily) {
        return NextResponse.json({ error: 'Heading font family is required when a heading stylesheet URL is provided' }, { status: 400 });
    }
    if (trimmedCustomBodyFontUrl && !trimmedCustomBodyFontFamily) {
        return NextResponse.json({ error: 'Body font family is required when a body stylesheet URL is provided' }, { status: 400 });
    }
    if (trimmedCustomBrandFontUrl && !trimmedCustomBrandFontFamily) {
        return NextResponse.json({ error: 'Brand font family is required when a brand stylesheet URL is provided' }, { status: 400 });
    }
    // AI field validation
    const AI_PROVIDERS = ['anthropic', 'openai', 'google', 'mistral'];
    const AI_PROVIDER_ENUM_MAP = {
        anthropic: 'ANTHROPIC',
        openai: 'OPENAI',
        google: 'GOOGLE',
        mistral: 'MISTRAL',
    };
    if (aiEnabled !== undefined && typeof aiEnabled !== 'boolean') {
        return NextResponse.json({ error: 'aiEnabled must be a boolean' }, { status: 400 });
    }
    if (aiProvider !== undefined && aiProvider !== null) {
        if (typeof aiProvider !== 'string' || !AI_PROVIDERS.includes(aiProvider.toLowerCase())) {
            return NextResponse.json({ error: 'aiProvider must be one of: anthropic, openai, google, mistral' }, { status: 400 });
        }
    }
    if (aiModel !== undefined && aiModel !== null) {
        if (typeof aiModel !== 'string') {
            return NextResponse.json({ error: 'aiModel must be a string' }, { status: 400 });
        }
        if (aiModel.trim().length > 120) {
            return NextResponse.json({ error: 'aiModel must be 120 characters or fewer' }, { status: 400 });
        }
    }
    if (aiApiKey !== undefined && aiApiKey !== null) {
        if (typeof aiApiKey !== 'string' || aiApiKey.trim().length === 0) {
            return NextResponse.json({ error: 'aiApiKey must be a non-empty string' }, { status: 400 });
        }
    }
    if (aiGreeting !== undefined && aiGreeting !== null) {
        if (typeof aiGreeting !== 'string') {
            return NextResponse.json({ error: 'aiGreeting must be a string' }, { status: 400 });
        }
        if (aiGreeting.trim().length > 500) {
            return NextResponse.json({ error: 'aiGreeting must be 500 characters or fewer' }, { status: 400 });
        }
    }
    if (aiInstructions !== undefined && aiInstructions !== null) {
        if (typeof aiInstructions !== 'string') {
            return NextResponse.json({ error: 'aiInstructions must be a string' }, { status: 400 });
        }
        if (aiInstructions.trim().length > 4000) {
            return NextResponse.json({ error: 'aiInstructions must be 4000 characters or fewer' }, { status: 400 });
        }
    }
    if (aiEscalationThreshold !== undefined) {
        if (typeof aiEscalationThreshold !== 'number' || isNaN(aiEscalationThreshold)) {
            return NextResponse.json({ error: 'aiEscalationThreshold must be a number' }, { status: 400 });
        }
    }
    if (productContext !== undefined && productContext !== null) {
        if (typeof productContext !== 'string') {
            return NextResponse.json({ error: 'productContext must be a string' }, { status: 400 });
        }
        if (productContext.trim().length > 4000) {
            return NextResponse.json({ error: 'productContext must be 4000 characters or fewer' }, { status: 400 });
        }
    }
    if (autoDraftGapsEnabled !== undefined && typeof autoDraftGapsEnabled !== 'boolean') {
        return NextResponse.json({ error: 'autoDraftGapsEnabled must be a boolean' }, { status: 400 });
    }
    if (autoDraftGapThreshold !== undefined) {
        if (typeof autoDraftGapThreshold !== 'number' || !Number.isInteger(autoDraftGapThreshold) || autoDraftGapThreshold < 1 || autoDraftGapThreshold > 100) {
            return NextResponse.json({ error: 'autoDraftGapThreshold must be an integer between 1 and 100' }, { status: 400 });
        }
    }
    if (autoDraftExternalEnabled !== undefined && typeof autoDraftExternalEnabled !== 'boolean') {
        return NextResponse.json({ error: 'autoDraftExternalEnabled must be a boolean' }, { status: 400 });
    }
    if (batchWindowMinutes !== undefined) {
        if (typeof batchWindowMinutes !== 'number' || !Number.isInteger(batchWindowMinutes) || batchWindowMinutes < 1 || batchWindowMinutes > 1440) {
            return NextResponse.json({ error: 'batchWindowMinutes must be an integer between 1 and 1440' }, { status: 400 });
        }
    }
    const clampedThreshold = aiEscalationThreshold !== undefined
        ? Math.min(1, Math.max(0, aiEscalationThreshold))
        : undefined;
    const resolvedAiProvider = aiProvider !== undefined && aiProvider !== null
        ? AI_PROVIDER_ENUM_MAP[aiProvider.toLowerCase()]
        : undefined;
    const trimmedAiModel = typeof aiModel === 'string' && aiModel.trim().length > 0 ? aiModel.trim() : null;
    const trimmedAiGreeting = typeof aiGreeting === 'string' && aiGreeting.trim().length > 0 ? aiGreeting.trim() : null;
    const trimmedAiInstructions = typeof aiInstructions === 'string' && aiInstructions.trim().length > 0 ? aiInstructions.trim() : null;
    const encryptedAiApiKey = typeof aiApiKey === 'string' && aiApiKey.trim().length > 0
        ? encryptApiKey(aiApiKey.trim())
        : undefined;
    const trimmedProductContext = typeof productContext === 'string' && productContext.trim().length > 0
        ? productContext.trim()
        : null;
    const canPersistFontPreset = fontPresetId === undefined ? false : await hasWorkspaceFontPresetColumn();
    const canPersistBrandText = brandText === undefined ? false : await hasWorkspaceBrandTextColumn();
    const canPersistFavicon = favicon === undefined ? false : await hasWorkspaceFaviconColumn();
    const canPersistMetaTitle = metaTitle === undefined ? false : await hasWorkspaceMetaTitleColumn();
    const canPersistMetaDescription = metaDescription === undefined ? false : await hasWorkspaceMetaDescriptionColumn();
    const canPersistCustomCreamColor = customCreamColor === undefined ? false : await hasWorkspaceCustomCreamColorColumn();
    const canPersistCustomInkColor = customInkColor === undefined ? false : await hasWorkspaceCustomInkColorColumn();
    const canPersistCustomMutedColor = customMutedColor === undefined ? false : await hasWorkspaceCustomMutedColorColumn();
    const canPersistCustomBorderColor = customBorderColor === undefined ? false : await hasWorkspaceCustomBorderColorColumn();
    const canPersistCustomAccentColor = customAccentColor === undefined ? false : await hasWorkspaceCustomAccentColorColumn();
    const canPersistCustomGreenColor = customGreenColor === undefined ? false : await hasWorkspaceCustomGreenColorColumn();
    const canPersistCustomWhiteColor = customWhiteColor === undefined ? false : await hasWorkspaceCustomWhiteColorColumn();
    const canPersistCustomRadius = customRadius === undefined ? false : await hasWorkspaceCustomRadiusColumn();
    const canPersistCustomHeadingFontFamily = customHeadingFontFamily === undefined ? false : await hasWorkspaceCustomHeadingFontFamilyColumn();
    const canPersistCustomHeadingFontUrl = customHeadingFontUrl === undefined ? false : await hasWorkspaceCustomHeadingFontUrlColumn();
    const canPersistCustomBodyFontFamily = customBodyFontFamily === undefined ? false : await hasWorkspaceCustomBodyFontFamilyColumn();
    const canPersistCustomBodyFontUrl = customBodyFontUrl === undefined ? false : await hasWorkspaceCustomBodyFontUrlColumn();
    const canPersistCustomBrandFontFamily = customBrandFontFamily === undefined ? false : await hasWorkspaceCustomBrandFontFamilyColumn();
    const canPersistCustomBrandFontUrl = customBrandFontUrl === undefined ? false : await hasWorkspaceCustomBrandFontUrlColumn();
    const canPersistProductContext = productContext === undefined ? false : await hasWorkspaceProductContextColumn();
    const canPersistAutoDraftGapsEnabled = autoDraftGapsEnabled === undefined ? false : await hasWorkspaceAutoDraftGapsEnabledColumn();
    const canPersistAutoDraftExternalEnabled = autoDraftExternalEnabled === undefined ? false : await hasWorkspaceAutoDraftExternalEnabledColumn();
    // 409 only when the client is trying to SET a non-empty value for a column that
    // doesn't exist yet (migration pending). Sending null/empty to clear a missing
    // column is harmless — we just skip persisting it — so no error is raised.
    if (typeof fontPresetId === 'string' && fontPresetId.length > 0 && !canPersistFontPreset) {
        return NextResponse.json({ error: 'Font presets require the latest database migration.' }, { status: 409 });
    }
    if ((typeof brandText === 'string' && brandText.trim().length > 0 && !canPersistBrandText) ||
        (typeof favicon === 'string' && favicon.trim().length > 0 && !canPersistFavicon) ||
        (typeof metaTitle === 'string' && metaTitle.trim().length > 0 && !canPersistMetaTitle) ||
        (typeof metaDescription === 'string' && metaDescription.trim().length > 0 && !canPersistMetaDescription)) {
        return NextResponse.json({ error: 'Workspace identity branding requires the latest database migration.' }, { status: 409 });
    }
    if ((typeof customCreamColor === 'string' && customCreamColor.trim().length > 0 && !canPersistCustomCreamColor) ||
        (typeof customInkColor === 'string' && customInkColor.trim().length > 0 && !canPersistCustomInkColor) ||
        (typeof customMutedColor === 'string' && customMutedColor.trim().length > 0 && !canPersistCustomMutedColor) ||
        (typeof customBorderColor === 'string' && customBorderColor.trim().length > 0 && !canPersistCustomBorderColor) ||
        (typeof customAccentColor === 'string' && customAccentColor.trim().length > 0 && !canPersistCustomAccentColor) ||
        (typeof customGreenColor === 'string' && customGreenColor.trim().length > 0 && !canPersistCustomGreenColor) ||
        (typeof customWhiteColor === 'string' && customWhiteColor.trim().length > 0 && !canPersistCustomWhiteColor) ||
        (typeof customRadius === 'string' && customRadius.trim().length > 0 && !canPersistCustomRadius)) {
        return NextResponse.json({ error: 'Custom theme overrides require the latest database migration.' }, { status: 409 });
    }
    if ((typeof customHeadingFontFamily === 'string' && customHeadingFontFamily.trim().length > 0 && !canPersistCustomHeadingFontFamily) ||
        (typeof customHeadingFontUrl === 'string' && customHeadingFontUrl.trim().length > 0 && !canPersistCustomHeadingFontUrl) ||
        (typeof customBodyFontFamily === 'string' && customBodyFontFamily.trim().length > 0 && !canPersistCustomBodyFontFamily) ||
        (typeof customBodyFontUrl === 'string' && customBodyFontUrl.trim().length > 0 && !canPersistCustomBodyFontUrl) ||
        (typeof customBrandFontFamily === 'string' && customBrandFontFamily.trim().length > 0 && !canPersistCustomBrandFontFamily) ||
        (typeof customBrandFontUrl === 'string' && customBrandFontUrl.trim().length > 0 && !canPersistCustomBrandFontUrl)) {
        return NextResponse.json({ error: 'Brand and content font overrides require the latest database migration.' }, { status: 409 });
    }
    // Find the workspace the current user owns/admins
    const member = await prisma.member.findFirst({
        where: {
            userId,
            role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { workspaceId: true },
    });
    if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
        const trimmedCustomDomain = typeof customDomain === 'string' && customDomain.trim().length > 0
            ? customDomain.trim()
            : null;
        const trimmedLogo = typeof logo === 'string' && logo.trim().length > 0
            ? logo.trim()
            : null;
        const updated = await prisma.workspace.update({
            where: { id: member.workspaceId },
            data: {
                ...(name ? { name: name.trim() } : {}),
                ...(slug ? { slug: slug } : {}),
                ...(customDomain !== undefined ? { customDomain: trimmedCustomDomain } : {}),
                ...(logo !== undefined ? { logo: trimmedLogo } : {}),
                ...(canPersistBrandText ? { brandText: trimmedBrandText } : {}),
                ...(canPersistFavicon ? { favicon: trimmedFavicon } : {}),
                ...(canPersistMetaTitle ? { metaTitle: trimmedMetaTitle } : {}),
                ...(canPersistMetaDescription ? { metaDescription: trimmedMetaDescription } : {}),
                ...(themeId ? { themeId: themeId } : {}),
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
                ...(aiEnabled !== undefined ? { aiEnabled: aiEnabled } : {}),
                ...(resolvedAiProvider !== undefined ? { aiProvider: resolvedAiProvider } : {}),
                ...(aiModel !== undefined ? { aiModel: trimmedAiModel } : {}),
                ...(encryptedAiApiKey !== undefined ? { aiApiKey: encryptedAiApiKey } : {}),
                ...(aiGreeting !== undefined ? { aiGreeting: trimmedAiGreeting } : {}),
                ...(aiInstructions !== undefined ? { aiInstructions: trimmedAiInstructions } : {}),
                ...(clampedThreshold !== undefined ? { aiEscalationThreshold: clampedThreshold } : {}),
                ...(canPersistProductContext ? { productContext: trimmedProductContext } : {}),
                ...(canPersistAutoDraftGapsEnabled ? { autoDraftGapsEnabled: autoDraftGapsEnabled } : {}),
                ...(autoDraftGapThreshold !== undefined ? { autoDraftGapThreshold: autoDraftGapThreshold } : {}),
                ...(canPersistAutoDraftExternalEnabled ? { autoDraftExternalEnabled: autoDraftExternalEnabled } : {}),
                ...(batchWindowMinutes !== undefined ? { batchWindowMinutes: batchWindowMinutes } : {}),
            },
        });
        return NextResponse.json(updated);
    }
    catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            return NextResponse.json({ error: 'This slug is already taken' }, { status: 409 });
        }
        throw e;
    }
}
