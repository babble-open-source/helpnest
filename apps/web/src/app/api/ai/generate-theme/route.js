import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth, resolveSessionUserId } from '@/lib/auth';
// Lazily initialised so the key is read at request time, not at build/module-load time.
let _anthropic = null;
function getAnthropic() {
    if (!_anthropic) {
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
    }
    return _anthropic;
}
const VALID_THEME_IDS = ['default', 'dark', 'ocean', 'forest', 'aurora', 'slate', 'rose', 'midnight'];
const VALID_RADII = ['none', 'sm', 'md', 'lg', 'xl'];
const COLOR_KEYS = [
    'customCreamColor',
    'customInkColor',
    'customMutedColor',
    'customBorderColor',
    'customAccentColor',
    'customGreenColor',
    'customWhiteColor',
];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const SYSTEM_PROMPT = `You are a brand researcher and UI/UX designer. Your job is to create a color palette for a customer-facing help center.

Step 1 — Research the brand:
- If the input names a real company, product, or brand (e.g. "Anthropic", "Stripe", "Notion", "GitHub"), recall everything you know about their visual identity: their actual website background, logo colors, primary action color, typography style, and overall aesthetic. Use those real colors as the foundation.
- If the brand is unfamiliar or the input is a general description, infer an appropriate palette from the description.

Step 2 — Map to the 7 help center color tokens:
• cream — main page background
• ink — primary text (must contrast with cream at ≥ 4.5:1, WCAG AA)
• muted — secondary/subdued text, slightly lower contrast than ink
• border — subtle dividers, just a shade off from cream
• accent — the brand's primary action color (buttons, links, highlights)
• green — success states and AI answer banners (calm, positive green)
• white — card and panel surfaces

Step 3 — Choose:
- Base theme (closest personality match): default, dark, ocean, forest, aurora, slate, rose, midnight
- Border radius: none (0px), sm (4px), md (8px), lg (12px), xl (16px)

Output ONLY the JSON below — no prose, no markdown fences:
{"themeId":"<id>","customCreamColor":"#RRGGBB","customInkColor":"#RRGGBB","customMutedColor":"#RRGGBB","customBorderColor":"#RRGGBB","customAccentColor":"#RRGGBB","customGreenColor":"#RRGGBB","customWhiteColor":"#RRGGBB","customRadius":"<radius>","reasoning":"<one sentence naming the brand colors used>"}`;
export async function POST(request) {
    const session = await auth();
    const userId = await resolveSessionUserId(session);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'AI theme generation requires ANTHROPIC_API_KEY.' }, { status: 503 });
    }
    let body;
    try {
        body = await request.json();
    }
    catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { prompt } = body;
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        return NextResponse.json({ error: 'prompt must be a non-empty string' }, { status: 400 });
    }
    if (prompt.trim().length > 500) {
        return NextResponse.json({ error: 'prompt must be 500 characters or fewer' }, { status: 400 });
    }
    let rawText;
    try {
        const message = await getAnthropic().messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: `Brand or description: ${prompt.trim()}` }],
        });
        const firstBlock = message.content[0];
        if (!firstBlock || firstBlock.type !== 'text') {
            return NextResponse.json({ error: 'AI returned an unexpected response. Try again.' }, { status: 502 });
        }
        rawText = firstBlock.text;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'AI service error';
        return NextResponse.json({ error: `AI generation failed: ${message}` }, { status: 502 });
    }
    // Strip optional ```json ... ``` code fences before parsing.
    const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let parsed;
    try {
        parsed = JSON.parse(stripped);
    }
    catch {
        return NextResponse.json({ error: 'AI returned malformed JSON. Try again.' }, { status: 502 });
    }
    // Validate each color field.
    for (const key of COLOR_KEYS) {
        const value = parsed[key];
        if (typeof value !== 'string' || !HEX_RE.test(value)) {
            return NextResponse.json({ error: `AI returned an invalid color for ${key}. Try again.` }, { status: 502 });
        }
    }
    // Sanitise themeId and customRadius to known-good values.
    const themeId = typeof parsed['themeId'] === 'string' && VALID_THEME_IDS.includes(parsed['themeId'])
        ? parsed['themeId']
        : 'default';
    const customRadius = typeof parsed['customRadius'] === 'string' && VALID_RADII.includes(parsed['customRadius'])
        ? parsed['customRadius']
        : 'md';
    const reasoning = typeof parsed['reasoning'] === 'string' ? parsed['reasoning'] : '';
    return NextResponse.json({
        themeId,
        customCreamColor: parsed['customCreamColor'],
        customInkColor: parsed['customInkColor'],
        customMutedColor: parsed['customMutedColor'],
        customBorderColor: parsed['customBorderColor'],
        customAccentColor: parsed['customAccentColor'],
        customGreenColor: parsed['customGreenColor'],
        customWhiteColor: parsed['customWhiteColor'],
        customRadius,
        reasoning,
    });
}
