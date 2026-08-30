import js from '@eslint/js';
import tsPlugin from 'typescript-eslint';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'node_modules/**',
      '**/dist/**',
      'dist/**',
      '**/build/**',
      'build/**',
      '**/.cache/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tsPlugin.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
    },
  },
  {
    files: ['**/*.cjs', 'scripts/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
