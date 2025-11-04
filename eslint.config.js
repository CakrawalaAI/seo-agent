import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

const tsRules = tseslint.configs.recommended.rules ?? {}

export default [
  {
    ignores: ['node_modules/**', 'dist/**']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ...js.configs.recommended,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tsRules,
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-console': 'error'
    }
  },
  {
    files: ['src/common/logger/index.ts'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      'no-console': 'off'
    }
  }
]
