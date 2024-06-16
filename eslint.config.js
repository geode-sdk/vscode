// @ts-check
const petal = require('@flowr/eslint-config').default;

module.exports = petal({
	ignores: ['out', 'dist', '**/playground/**'],
	markdown: false,
	formatters: true,
}).removeRules('node/prefer-global/process');
