import { defineConfig } from 'tsup';

export default defineConfig({
	format: ['cjs'],
	entry: ['src/index.ts'],
	shims: false,
	dts: false,
	clean: true,
	env: {
		NODE_ENV: process.env.NODE_ENV || 'production',
	},
	external: ['vscode', 'sharp'],
});
