# @helpnest/config

Centralized build and style configuration shared across the HelpNest monorepo. Contains the Tailwind CSS config with design tokens, the TypeScript base config, and optionally ESLint config.

## Exports

| Export path | Contents |
|---|---|
| `@helpnest/config/tailwind` | Tailwind config with design token CSS variables |
| `@helpnest/config/tsconfig` | `tsconfig.base.json` for use with `extends` |

## Tailwind Configuration

### Usage

In any package's `tailwind.config.ts`:

```ts
import base from '@helpnest/config/tailwind'

export default {
  ...base,
  content: ['./src/**/*.{ts,tsx}'],
}
```

### Design Tokens

All tokens are exposed as CSS variables and integrated with Tailwind's utility class system. Colors support the opacity modifier syntax via `rgb(var(--color-X) / <alpha-value>)`.

**Colors**

| Variable | Purpose |
|---|---|
| `--color-cream` | Background / surface |
| `--color-ink` | Primary text |
| `--color-accent` | Brand accent |
| `--color-green` | Success / positive |
| `--color-border` | Border and divider |
| `--color-white` | Pure white |
| `--color-muted` | Secondary / muted text |

**Typography**

| Variable | Purpose |
|---|---|
| `--font-heading` | Heading font family |
| `--font-body` | Body font family |

**Shape**

| Variable | Purpose |
|---|---|
| `--radius` | Base border radius |

## TypeScript Configuration

### Usage

In any package's `tsconfig.json`:

```json
{
  "extends": "@helpnest/config/tsconfig"
}
```

### Key Settings

| Option | Value |
|---|---|
| `target` | `ES2022` |
| `strict` | `true` |
| `jsx` | `preserve` |
| `moduleResolution` | `bundler` |
| `noUncheckedIndexedAccess` | `true` |
