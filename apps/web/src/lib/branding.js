import { getTheme, themeToCSS, themes } from '@/lib/themes';
export const radiusOptions = ['none', 'sm', 'md', 'lg', 'xl'];
export const colorOverrideKeys = [
    'cream',
    'ink',
    'muted',
    'border',
    'accent',
    'green',
    'white',
];
function quoteFontFamily(fontFamily) {
    const trimmed = fontFamily.trim();
    if (trimmed.length === 0)
        return trimmed;
    if (trimmed.startsWith('"') || trimmed.startsWith("'") || trimmed.includes(','))
        return trimmed;
    return `"${trimmed.replace(/"/g, '\\"')}"`;
}
function primaryFontLabel(fontFamily) {
    const [primary = 'Sans Serif'] = fontFamily.split(',');
    return primary.trim().replace(/^['"]|['"]$/g, '');
}
const presetMap = new Map();
for (const theme of themes) {
    const key = primaryFontLabel(theme.fonts.heading);
    if (presetMap.has(key))
        continue;
    presetMap.set(key, {
        id: theme.id,
        name: theme.name,
        headingLabel: primaryFontLabel(theme.fonts.heading),
        bodyLabel: primaryFontLabel(theme.fonts.body),
        fonts: theme.fonts,
    });
}
export const fontPresets = Array.from(presetMap.values());
export function getFontPreset(id) {
    if (!id)
        return undefined;
    return fontPresets.find((preset) => preset.id === id);
}
export function resolveWorkspaceTheme(themeId, overrides = {}) {
    const baseTheme = getTheme(themeId);
    const fontPreset = getFontPreset(overrides.fontPresetId);
    const customHeadingFamily = overrides.customHeadingFontFamily?.trim() ?? '';
    const customHeadingUrl = overrides.customHeadingFontUrl?.trim() || undefined;
    const customBodyFamily = overrides.customBodyFontFamily?.trim() ?? '';
    const customBodyUrl = overrides.customBodyFontUrl?.trim() || undefined;
    const theme = fontPreset
        ? {
            ...baseTheme,
            fonts: fontPreset.fonts,
        }
        : baseTheme;
    const nextTheme = {
        ...theme,
        colors: {
            cream: overrides.customCreamColor?.trim() || theme.colors.cream,
            ink: overrides.customInkColor?.trim() || theme.colors.ink,
            muted: overrides.customMutedColor?.trim() || theme.colors.muted,
            border: overrides.customBorderColor?.trim() || theme.colors.border,
            accent: overrides.customAccentColor?.trim() || theme.colors.accent,
            green: overrides.customGreenColor?.trim() || theme.colors.green,
            white: overrides.customWhiteColor?.trim() || theme.colors.white,
        },
        radius: overrides.customRadius ?? theme.radius,
        fonts: { ...theme.fonts },
    };
    const nextFonts = { ...nextTheme.fonts };
    if (customHeadingFamily.length > 0) {
        const family = quoteFontFamily(customHeadingFamily);
        nextFonts.heading = `${family}, ${theme.fonts.heading}`;
        nextFonts.headingUrl = customHeadingUrl;
    }
    if (customBodyFamily.length > 0) {
        const family = quoteFontFamily(customBodyFamily);
        nextFonts.body = `${family}, ${theme.fonts.body}`;
        nextFonts.bodyUrl = customBodyUrl;
    }
    nextTheme.fonts = nextFonts;
    return nextTheme;
}
export function getWorkspaceBrandFontStack(themeId, overrides = {}) {
    const customBrandFamily = overrides.customBrandFontFamily?.trim() ?? '';
    if (customBrandFamily.length === 0)
        return null;
    const theme = resolveWorkspaceTheme(themeId, overrides);
    return `${quoteFontFamily(customBrandFamily)}, ${theme.fonts.heading}`;
}
export function getWorkspaceThemeCSS(themeId, overrides = {}) {
    const theme = resolveWorkspaceTheme(themeId, overrides);
    const brandFontStack = getWorkspaceBrandFontStack(themeId, overrides);
    const baseCss = themeToCSS(theme);
    return brandFontStack ? `${baseCss}; --font-brand: ${brandFontStack}` : baseCss;
}
export function getWorkspaceFontUrls(themeId, overrides = {}) {
    const theme = resolveWorkspaceTheme(themeId, overrides);
    const customBrandFontUrl = overrides.customBrandFontUrl?.trim() || undefined;
    return Array.from(new Set([theme.fonts.headingUrl, theme.fonts.bodyUrl, customBrandFontUrl].filter((url) => Boolean(url))));
}
export function getAllFontPresetUrls() {
    return Array.from(new Set(fontPresets.flatMap((preset) => [preset.fonts.headingUrl, preset.fonts.bodyUrl].filter((url) => Boolean(url)))));
}
