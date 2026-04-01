import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

// Run tests with:
//   bun add -D vitest
//   bunx vitest run
//
// The sveltekit plugin compiles .svelte.ts files so that Svelte 5 runes
// ($state, $derived, $effect) are available in tests.

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		globals: false
	}
});
