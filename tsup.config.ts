import { defineConfig } from 'tsup';

export default defineConfig({
	format: 'cjs',
	target: 'node',
	entry: ['./src/extension.ts'],
	external: ['vscode', 'sharp'],
});
