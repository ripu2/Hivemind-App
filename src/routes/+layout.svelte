<script lang="ts">
	import './layout.css';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';

	const queryClient = new QueryClient();
	let { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
	{@render children()}
	<SvelteQueryDevtools />
</QueryClientProvider>
