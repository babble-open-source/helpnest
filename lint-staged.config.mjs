import path from 'node:path'

const webRoot = path.resolve(import.meta.dirname, 'apps/web')

function eslintForWorkspace(workspaceDir) {
  return (files) => {
    const scoped = files.filter((f) => f.startsWith(workspaceDir))
    if (scoped.length === 0) return []
    const quotedFiles = scoped.map((f) => JSON.stringify(f)).join(' ')
    return `cd ${JSON.stringify(workspaceDir)} && npx eslint --fix --no-warn-ignored ${quotedFiles}`
  }
}

export default {
  '*.{ts,tsx,js,jsx,mjs}': ['prettier --write'],
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
  'apps/web/**/*.{ts,tsx,js,jsx}': eslintForWorkspace(webRoot),
}
