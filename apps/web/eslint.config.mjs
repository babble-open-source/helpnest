import coreWebVitals from 'eslint-config-next/core-web-vitals'

export default [
  ...coreWebVitals,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Valid patterns: initializing state from localStorage and resetting derived UI state
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]
