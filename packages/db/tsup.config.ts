import { defineConfig } from 'tsup'
import type { Plugin } from 'esbuild'

// esbuild plugin: fix import.meta.url in CJS output.
// Prisma 7's generated TypeScript uses `import.meta.url` to set __dirname,
// which esbuild replaces with `{}` in CJS mode, breaking the call to
// fileURLToPath(). This plugin swaps the empty placeholder for a real URL
// derived from __filename so the Prisma runtime can resolve its paths.
const importMetaUrlPlugin: Plugin = {
  name: 'fix-import-meta-url-cjs',
  setup(build) {
    if (build.initialOptions.format !== 'cjs') return
    build.onEnd((result) => {
      for (const file of result.outputFiles ?? []) {
        if (!file.path.endsWith('.js')) continue
        const patched = file.text.replace(
          /var import_meta\s*=\s*\{\};/g,
          "var import_meta = { url: require('url').pathToFileURL(__filename).href };",
        )
        if (patched === file.text) continue // no placeholder found — nothing to patch
        const encoder = new TextEncoder()
        Object.defineProperty(file, 'contents', {
          value: encoder.encode(patched),
          writable: true,
        })
      }
    })
  },
}

const sharedEsbuildOptions = {
  esbuildPlugins: [importMetaUrlPlugin],
  esbuildOptions(options: Record<string, unknown>) {
    options.logOverride = { 'empty-import-meta': 'silent' }
  },
}

export default defineConfig([
  // ── Library: @helpnest/db public API (CJS + ESM) ──────────────────────────
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    // Types come from the hand-written root index.d.ts which re-exports
    // directly from generated/prisma/client, preserving value exports like
    // PrismaClientKnownRequestError that the DTS bundler would drop as type-only.
    dts: false,
    clean: true,
    sourcemap: false,
    bundle: true,
    external: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
    ...sharedEsbuildOptions,
  },
  // ── Seed script: CJS bundle for both local dev and production ─────────────
  // Outputs dist/seed.js — run with `node dist/seed.js` in both environments.
  // pg stays external (native module); bcryptjs is bundled inline.
  // @prisma/client and @prisma/adapter-pg stay external so their WASM files
  // and platform-specific code are resolved from node_modules at runtime.
  {
    entry: { seed: 'prisma/seed.ts' },
    format: ['cjs'],
    dts: false,
    clean: false, // don't wipe dist/ — library was already written above
    sourcemap: false,
    bundle: true,
    external: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
    ...sharedEsbuildOptions,
  },
])
