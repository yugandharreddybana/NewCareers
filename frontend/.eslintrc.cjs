/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-refresh',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    // React 17+ JSX transform — no need to import React in every file
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',

    // Prevent common bugs
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Enforce lazy-load consistency (warn, not error, to allow gradual fix)
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

    // Guard against accidental console.logs left in production code
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  settings: {
    react: { version: 'detect' },
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', 'vite.config.ts'],
};
