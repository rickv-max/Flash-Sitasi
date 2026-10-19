import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  { files: ['**/*.{js,jsx,mjs}'], extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 'latest', globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }] } },
  { files: ['src/**/*.{js,jsx}'], extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    rules: { 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } },
]);
