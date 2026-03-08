import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// process.cwd() in Next.js (both dev and standalone production) is always the
// app root (apps/web). We go two levels up to the monorepo root, then into the
// widget package's dist output.
const WIDGET_DIST = path.resolve(
  process.cwd(),
  '../../packages/widget/dist/widget.js'
)

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  if (!fs.existsSync(WIDGET_DIST)) {
    return NextResponse.json(
      { error: 'Widget not built. Run pnpm --filter @helpnest/widget build.' },
      { status: 503 }
    )
  }

  const source = fs.readFileSync(WIDGET_DIST, 'utf-8')

  return new NextResponse(source, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/javascript; charset=utf-8',
      // Allow browsers to cache the widget for 5 minutes; CDN for 1 hour.
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  })
}
