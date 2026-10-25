// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import expoConfig from 'eslint-config-expo/flat.js';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const NODE_WORKSPACES = ['server', 'shared', 'mockstores'];
const CODE = '**/*.{js,cjs,mjs,ts,cts,mts,jsx,tsx}';

/**
 * Restricts a shared config block to one directory. Expo's preset registers its own
 * `@typescript-eslint` plugin, so it must never apply to the same files as typescript-eslint.
 * @param {import('eslint').Linter.Config} block
 * @param {string} dir
 * @returns {import('eslint').Linter.Config}
 */
const scopeTo = (block, dir) => ({
  ...block,
  files: (block.files ?? [CODE]).map((pattern) =>
    typeof pattern === 'string'
      ? `${dir}/${pattern.startsWith('**/') ? pattern : `**/${pattern}`}`
      : pattern,
  ),
});

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    '**/.expo/',
    'mobile/android/',
    'mobile/ios/',
    'mobile/expo-env.d.ts',
  ]),

  // Root config files (eslint.config.js etc.)
  {
    files: ['*.{js,mjs,cjs,ts}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // Node workspaces: server, shared, mockstores
  ...[js.configs.recommended, ...tseslint.configs.recommended].map((block) => ({
    ...block,
    files: NODE_WORKSPACES.map((dir) => `${dir}/${CODE}`),
  })),
  {
    files: NODE_WORKSPACES.map((dir) => `${dir}/${CODE}`),
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
    },
  },
  // Smoke tests and CLIs print to the terminal on purpose
  {
    files: ['server/smoke/**', 'server/src/seed/**', 'mockstores/src/cli.ts'],
    rules: { 'no-console': 'off' },
  },

  // Mobile: Expo preset + React Hooks
  ...expoConfig.map((block) => scopeTo(block, 'mobile')),
  scopeTo(reactHooks.configs.flat['recommended-latest'], 'mobile'),
  {
    // Resolve the `@/` alias from mobile/tsconfig.json (Expo's preset only knows Node paths).
    files: [`mobile/${CODE}`],
    settings: {
      'import/resolver': {
        typescript: { project: 'mobile/tsconfig.json' },
        node: true,
      },
    },
  },

  // Test files
  {
    files: ['server/**/*.test.ts', 'shared/**/*.test.ts', 'server/tests/**/*.ts'],
    languageOptions: { globals: globals.vitest },
  },
  {
    files: ['mobile/**/*.test.{ts,tsx}', 'mobile/**/__tests__/**', 'mobile/jest.setup.*'],
    languageOptions: { globals: globals.jest },
  },

  prettier,
]);
