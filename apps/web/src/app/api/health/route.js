import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { qdrant } from '@/lib/qdrant';
export const dynamic = 'force-dynamic';
export async function GET() {
    const checks = {};
    // Database connectivity
    try {
        await prisma.$queryRaw `SELECT 1`;
        checks.database = 'ok';
    }
    catch {
        checks.database = 'error';
    }
    // Qdrant — only checked when configured
    if (process.env.QDRANT_URL) {
        try {
            await qdrant.getCollections();
            checks.qdrant = 'ok';
        }
        catch {
            checks.qdrant = 'error';
        }
    }
    const allOk = Object.values(checks).every((v) => v === 'ok');
    return NextResponse.json({ status: allOk ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() }, { status: allOk ? 200 : 503 });
}
