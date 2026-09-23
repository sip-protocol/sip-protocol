/**
 * ESLint flat config (ESLint 9+ / 10+). Replaces the former root .eslintrc.js
 * (required for eslint >= 10, which no longer reads .eslintrc*).
 *
 * Scope is unchanged from the legacy setup: only TypeScript sources are linted
 * (dot-js files are globally ignored, as in the legacy ignorePatterns).
 */
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = tseslint.config(
	{
		ignores: ['**/dist/**', '**/node_modules/**', '**/*.js'],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.node,
			},
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': 'warn',
			'no-useless-catch': 'warn',
			// Allow intentional marker interfaces (`interface X extends Y {}`) used as
			// named extension points for wallet adapter APIs.
			'@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
		},
	},
);
