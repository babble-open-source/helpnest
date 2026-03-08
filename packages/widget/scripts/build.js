const esbuild = require('esbuild')
const isWatch = process.argv.includes('--watch')

const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/widget.js',
  format: 'iife',
  globalName: 'HelpNestWidget',
  minify: !isWatch,
  sourcemap: isWatch,
  target: ['es2017', 'chrome70', 'firefox70', 'safari12'],
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
}

if (isWatch) {
  esbuild.context(config).then(ctx => {
    ctx.watch()
    console.log('Watching...')
  })
} else {
  esbuild.build(config).then(() => {
    console.log('Widget built → dist/widget.js')
  }).catch(() => process.exit(1))
}
