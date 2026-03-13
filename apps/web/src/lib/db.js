import { Prisma, PrismaClient } from '@helpnest/db';
const globalForPrisma = globalThis;
/**
 * Ensure connection pool settings are present in the DATABASE_URL.
 * Defaults keep a small pool suitable for a long-running Next.js server.
 * Override in production by adding ?connection_limit=N&pool_timeout=N to DATABASE_URL.
 */
function buildDatabaseUrl() {
    const url = process.env.DATABASE_URL;
    if (!url)
        return '';
    try {
        const parsed = new URL(url);
        if (!parsed.searchParams.has('connection_limit')) {
            parsed.searchParams.set('connection_limit', '10');
        }
        if (!parsed.searchParams.has('pool_timeout')) {
            parsed.searchParams.set('pool_timeout', '20');
        }
        return parsed.toString();
    }
    catch {
        return url;
    }
}
export const prisma = globalForPrisma.prisma ??
    new PrismaClient({
        datasources: { db: { url: buildDatabaseUrl() } },
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prisma;
export function hasWorkspaceColumn(columnName) {
    const cache = (globalForPrisma.workspaceColumnExists ??= {});
    cache[columnName] ??= prisma
        .$queryRaw(Prisma.sql `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Workspace'
          AND column_name = ${columnName}
      ) AS "exists"
    `)
        .then((rows) => rows[0]?.exists ?? false)
        .catch(() => false);
    return cache[columnName];
}
export const hasWorkspaceFontPresetColumn = () => hasWorkspaceColumn('fontPresetId');
export const hasWorkspaceBrandTextColumn = () => hasWorkspaceColumn('brandText');
export const hasWorkspaceFaviconColumn = () => hasWorkspaceColumn('favicon');
export const hasWorkspaceMetaTitleColumn = () => hasWorkspaceColumn('metaTitle');
export const hasWorkspaceMetaDescriptionColumn = () => hasWorkspaceColumn('metaDescription');
export const hasWorkspaceCustomCreamColorColumn = () => hasWorkspaceColumn('customCreamColor');
export const hasWorkspaceCustomInkColorColumn = () => hasWorkspaceColumn('customInkColor');
export const hasWorkspaceCustomMutedColorColumn = () => hasWorkspaceColumn('customMutedColor');
export const hasWorkspaceCustomBorderColorColumn = () => hasWorkspaceColumn('customBorderColor');
export const hasWorkspaceCustomAccentColorColumn = () => hasWorkspaceColumn('customAccentColor');
export const hasWorkspaceCustomGreenColorColumn = () => hasWorkspaceColumn('customGreenColor');
export const hasWorkspaceCustomWhiteColorColumn = () => hasWorkspaceColumn('customWhiteColor');
export const hasWorkspaceCustomRadiusColumn = () => hasWorkspaceColumn('customRadius');
export const hasWorkspaceCustomHeadingFontFamilyColumn = () => hasWorkspaceColumn('customHeadingFontFamily');
export const hasWorkspaceCustomHeadingFontUrlColumn = () => hasWorkspaceColumn('customHeadingFontUrl');
export const hasWorkspaceCustomBodyFontFamilyColumn = () => hasWorkspaceColumn('customBodyFontFamily');
export const hasWorkspaceCustomBodyFontUrlColumn = () => hasWorkspaceColumn('customBodyFontUrl');
export const hasWorkspaceCustomBrandFontFamilyColumn = () => hasWorkspaceColumn('customBrandFontFamily');
export const hasWorkspaceCustomBrandFontUrlColumn = () => hasWorkspaceColumn('customBrandFontUrl');
export const hasWorkspaceProductContextColumn = () => hasWorkspaceColumn('productContext');
export const hasWorkspaceAutoDraftGapsEnabledColumn = () => hasWorkspaceColumn('autoDraftGapsEnabled');
export const hasWorkspaceAutoDraftExternalEnabledColumn = () => hasWorkspaceColumn('autoDraftExternalEnabled');
