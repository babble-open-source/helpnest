import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: false,
  treeshake: true,
  noExternal: ['@helpnest/sdk'],
  banner: {
    js: '#!/usr/bin/env node',
  },
})
