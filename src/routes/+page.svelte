<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { marked } from 'marked';
	import {
		MessageSquare, Plus, Send, Globe, ChevronRight, Menu, X, Trash2,
		LoaderCircle, ExternalLink, Link, CircleAlert, CircleCheck,
		Clock, Wifi, WifiOff
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { chat } from '$lib/chat.svelte';
	import { sendQuery, fetchFAQs, crawlURL, fetchHealth, ApiError } from '$lib/api';
	import { sourceHref, sourceLabel } from '$lib/source-url';
	import { tick } from 'svelte';

	// ── State ─────────────────────────────────────────────────────────────────
	let input = $state('');
	let isLoading = $state(false);
	let sidebarOpen = $state(false);
	let messagesEl = $state<HTMLElement | null>(null);

	// Crawl panel
	let crawlUrl = $state('');
	let crawlLoading = $state(false);
	let showCrawl = $state(false);

	type CrawlState =
		| { type: 'idle' }
		| { type: 'indexing'; url: string }
		| { type: 'already_indexed'; url: string }
		| { type: 'error'; message: string };
	let crawlState = $state<CrawlState>({ type: 'idle' });

	type QueryError =
		| { type: 'not_indexed'; message: string }
		| { type: 'offline'; message: string }
		| null;
	let queryError = $state<QueryError>(null);
	let lastFailedText = $state('');

	// ── TanStack Queries ──────────────────────────────────────────────────────
	const faqsQuery = createQuery(() => ({
		queryKey: ['faqs'],
		queryFn: fetchFAQs,
		staleTime: 5 * 60 * 1000
	}));

	const healthQuery = createQuery(() => ({
		queryKey: ['health'],
		queryFn: fetchHealth,
		refetchInterval: 60_000,
		staleTime: 30_000
	}));

	const serverHealthy = $derived(healthQuery.data?.status === 'healthy');
	const serverOnline  = $derived(healthQuery.data?.status === 'healthy' || healthQuery.data?.status === 'degraded');

	// ── Helpers ───────────────────────────────────────────────────────────────
	function renderMarkdown(md: string): string {
		return marked.parse(md) as string;
	}

	async function scrollToBottom() {
		await tick();
		if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function ensureConversation(): string {
		return chat.activeId ?? chat.newConversation();
	}

	// ── Send message ──────────────────────────────────────────────────────────
	async function handleSend() {
		const text = input.trim();
		if (!text || isLoading) return;

		const convId = ensureConversation();
		input = '';
		isLoading = true;
		queryError = null;

		chat.addMessage(convId, { role: 'user', content: text });
		await scrollToBottom();

		const conv = chat.conversations.find((c) => c.id === convId);

		try {
			const res = await sendQuery({
				question: text,
				url: conv?.scopeUrl ?? undefined,
				conversation_id: conv?.conversationId
			});
			isLoading = false;
			chat.setConversationId(convId, res.conversation_id);
			chat.addMessage(convId, { role: 'assistant', content: res.answer, sources: res.sources });
		} catch (err: unknown) {
			isLoading = false;
			const isNetworkError = err instanceof TypeError && err.message.toLowerCase().includes('fetch');

			if (err instanceof ApiError && err.status === 404) {
				queryError = {
					type: 'not_indexed',
					message: conv?.scopeUrl
						? `"${conv.scopeUrl}" hasn't been indexed yet. Add it via the sidebar panel.`
						: 'No documents indexed yet. Add a website URL to get started.'
				};
				chat.removeLastMessage(convId);
			} else if (isNetworkError) {
				queryError = { type: 'offline', message: text };
				lastFailedText = text;
				chat.removeLastMessage(convId);
			} else {
				const msg = err instanceof Error ? err.message : 'Unknown error';
				chat.addMessage(convId, { role: 'assistant', content: `Something went wrong: ${msg}` });
			}
		} finally {
			isLoading = false;
			await scrollToBottom();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
	}

	function retryLastMessage() {
		if (!lastFailedText) return;
		input = lastFailedText;
		queryError = null;
		lastFailedText = '';
		handleSend();
	}

	function useFaq(question: string) {
		input = question;
		sidebarOpen = false;
	}

	// ── Crawl ─────────────────────────────────────────────────────────────────
	async function handleCrawl() {
		const url = crawlUrl.trim();
		if (!url || crawlLoading) return;
		crawlLoading = true;
		crawlState = { type: 'idle' };
		try {
			await crawlURL(url);
			crawlState = { type: 'indexing', url };
			chat.setScopeUrl(ensureConversation(), url);
			crawlUrl = '';
		} catch (err: unknown) {
			if (err instanceof ApiError && err.status === 409) {
				crawlState = { type: 'already_indexed', url };
				chat.setScopeUrl(ensureConversation(), url);
				crawlUrl = '';
			} else {
				crawlState = { type: 'error', message: err instanceof Error ? err.message : 'Crawl failed' };
			}
		} finally {
			crawlLoading = false;
		}
	}

	// ── Init ──────────────────────────────────────────────────────────────────
	$effect(() => { if (chat.conversations.length === 0) chat.newConversation(); });
	$effect(() => { if (chat.active?.messages.length) scrollToBottom(); });

	const faqs = $derived(faqsQuery.data?.faqs ?? []);
	const hasMessages = $derived((chat.active?.messages.length ?? 0) > 0);
</script>

<div class="flex h-screen overflow-hidden bg-white">
	<!-- Mobile overlay -->
	{#if sidebarOpen}
		<div class="fixed inset-0 z-20 bg-black/30 lg:hidden" onclick={() => (sidebarOpen = false)} role="presentation"></div>
	{/if}

	<!-- ── Sidebar ────────────────────────────────────────────────────────── -->
	<aside class="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-gray-100 bg-white/80 backdrop-blur-xl transition-transform duration-300 lg:relative lg:translate-x-0 {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}">
		<div class="flex items-center justify-between px-5 py-5">
			<div class="flex items-center gap-2.5">
				<img src="/favicon.png" class="h-8 w-8 rounded-xl shadow-sm object-cover" alt="Hivemind" />
				<span class="text-[15px] font-semibold tracking-tight text-gray-900">Hivemind</span>
			</div>
			<button class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden" onclick={() => (sidebarOpen = false)} aria-label="Close">
				<X class="h-4 w-4" />
			</button>
		</div>

		<div class="px-3 pb-3">
			<button class="flex w-full items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
				onclick={() => { chat.newConversation(); sidebarOpen = false; }}>
				<Plus class="h-4 w-4" /> New chat
			</button>
		</div>

		<Separator class="bg-gray-100" />

		<div class="flex-1 overflow-y-auto py-2">
			{#if chat.conversations.length > 0}
				<p class="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Recent</p>
				{#each chat.conversations as conv (conv.id)}
					<div class="group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors {conv.id === chat.activeId ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}"
						role="button" tabindex="0"
						onclick={() => { chat.setActive(conv.id); sidebarOpen = false; }}
						onkeydown={(e) => e.key === 'Enter' && chat.setActive(conv.id)}>
						<MessageSquare class="h-3.5 w-3.5 shrink-0 opacity-50" />
						<span class="flex-1 truncate">{conv.title}</span>
						{#if conv.scopeUrl}<Globe class="h-3 w-3 shrink-0 text-violet-400 opacity-70" />{/if}
						<button class="hidden shrink-0 rounded p-0.5 text-gray-400 hover:text-red-400 group-hover:block"
							onclick={(e) => { e.stopPropagation(); chat.deleteConversation(conv.id); }} aria-label="Delete">
							<Trash2 class="h-3 w-3" />
						</button>
					</div>
				{/each}
			{/if}

			{#if faqs.length > 0}
				<Separator class="my-2 bg-gray-100" />
				<p class="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Suggested</p>
				{#each faqs as faq (faq.id)}
					<button class="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800" onclick={() => useFaq(faq.question)}>
						<ChevronRight class="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
						<span class="line-clamp-2">{faq.question}</span>
					</button>
				{/each}
			{/if}
		</div>

		<Separator class="bg-gray-100" />
		<div class="p-3">
			<button class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800" onclick={() => (showCrawl = !showCrawl)}>
				<Globe class="h-4 w-4" /> <span>Index a website</span>
				<ChevronRight class="ml-auto h-3 w-3 transition-transform {showCrawl ? 'rotate-90' : ''}" />
			</button>
			{#if showCrawl}
				<div class="mt-2 space-y-2">
					<input type="url" placeholder="https://docs.example.com" bind:value={crawlUrl}
						class="w-full rounded-xl border border-gray-200 bg-white/60 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-300"
						onkeydown={(e) => e.key === 'Enter' && handleCrawl()} />
					<Button size="sm" class="w-full rounded-xl border-0 bg-violet-500 text-white hover:bg-violet-600" disabled={crawlLoading || !crawlUrl.trim()} onclick={handleCrawl}>
						{#if crawlLoading}<LoaderCircle class="mr-1.5 h-3.5 w-3.5 animate-spin" />Indexing…
						{:else}<Link class="mr-1.5 h-3.5 w-3.5" />Index{/if}
					</Button>
					{#if crawlState.type === 'indexing'}
						<div class="flex items-start gap-1.5 rounded-xl bg-violet-50 px-3 py-2">
							<Clock class="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
							<p class="text-xs text-violet-700">Crawling in background — start asking questions shortly.</p>
						</div>
					{:else if crawlState.type === 'already_indexed'}
						<div class="flex items-start gap-1.5 rounded-xl bg-emerald-50 px-3 py-2">
							<CircleCheck class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
							<p class="text-xs text-emerald-700">Already indexed — start asking questions now.</p>
						</div>
					{:else if crawlState.type === 'error'}
						<div class="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2">
							<CircleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
							<p class="text-xs text-red-600">{crawlState.message}</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</aside>

	<!-- ── Main area ──────────────────────────────────────────────────────── -->
	<div class="relative flex flex-1 flex-col overflow-hidden">

		<!-- Gradient blobs -->
		<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
			<div class="absolute -bottom-20 -left-20 h-[500px] w-[500px] rounded-full opacity-40" style="background:radial-gradient(circle,#f0abfc 0%,#f9a8d4 40%,transparent 70%)"></div>
			<div class="absolute -bottom-10 left-1/3 h-[550px] w-[550px] rounded-full opacity-35" style="background:radial-gradient(circle,#c4b5fd 0%,#a5b4fc 40%,transparent 70%)"></div>
			<div class="absolute -right-16 -top-16 h-[320px] w-[320px] rounded-full opacity-20" style="background:radial-gradient(circle,#f0abfc 0%,#f9a8d4 50%,transparent 75%)"></div>
			<div class="absolute -left-10 -top-10 h-[260px] w-[260px] rounded-full opacity-15" style="background:radial-gradient(circle,#c4b5fd 0%,#a5b4fc 50%,transparent 75%)"></div>
		</div>

		<!-- Header -->
		<header class="relative z-10 flex items-center gap-3 border-b border-gray-100/80 bg-white/60 px-4 py-3 backdrop-blur-sm">
			<button class="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 lg:hidden" onclick={() => (sidebarOpen = true)} aria-label="Open sidebar">
				<Menu class="h-5 w-5" />
			</button>
			<div class="flex flex-1 items-center gap-2 min-w-0">
				<img src="/favicon.png" class="h-7 w-7 shrink-0 rounded-lg object-cover shadow-sm" alt="Hivemind" />
				<span class="truncate text-sm font-semibold text-gray-800">
					{hasMessages ? (chat.active?.title ?? 'Hivemind AI') : 'Hivemind AI'}
				</span>
			</div>
			{#if chat.active?.scopeUrl}
				<Badge class="hidden shrink-0 gap-1 rounded-full border-violet-200 bg-violet-50 text-violet-600 sm:flex">
					<Globe class="h-3 w-3" />
					<span class="max-w-32 truncate text-xs">{chat.active.scopeUrl}</span>
				</Badge>
			{/if}
			<div class="flex shrink-0 items-center gap-1.5">
				{#if healthQuery.isPending}
					<span class="h-2 w-2 rounded-full bg-gray-300 animate-pulse"></span>
				{:else if serverHealthy}
					<Wifi class="h-3.5 w-3.5 text-emerald-500" />
				{:else if serverOnline}
					<Wifi class="h-3.5 w-3.5 text-amber-400" />
				{:else}
					<WifiOff class="h-3.5 w-3.5 text-red-400" />
				{/if}
				<span class="hidden text-[11px] text-gray-400 sm:block">
					{#if healthQuery.isPending}Connecting…
					{:else if serverHealthy}Online
					{:else if serverOnline}Degraded
					{:else if queryError?.type === 'offline'}Waking up…
					{:else}Offline{/if}
				</span>
			</div>
		</header>

		<!-- Messages -->
		<div class="relative z-10 flex-1 overflow-y-auto" bind:this={messagesEl}>
			{#if !hasMessages}
				<!-- Empty state -->
				<div class="flex h-full flex-col items-center px-4 pt-16 text-center">
					<div class="relative mb-6 flex items-center justify-center">
						<div class="absolute h-24 w-24 rounded-full border border-pink-200/60"></div>
						<div class="absolute h-16 w-16 rounded-full border border-violet-200/60"></div>
						<img src="/favicon.png" class="relative h-10 w-10 rounded-2xl object-cover shadow-sm ring-1 ring-gray-200/80" alt="Hivemind" />
					</div>
					<h1 class="text-2xl font-semibold tracking-tight text-gray-900">Ask our AI anything</h1>
					<p class="mt-1.5 text-sm text-gray-400">Powered by your indexed documents</p>

					{#if queryError?.type === 'offline'}
						<div class="mt-4 w-full max-w-md rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-left">
							<div class="flex items-start gap-2.5">
								<WifiOff class="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
								<div class="flex-1">
									<p class="text-sm font-medium text-violet-800">Server is waking up</p>
									<p class="mt-0.5 text-xs text-violet-600">Free tier takes ~30s to start. Your message was saved.</p>
								</div>
							</div>
							<button class="mt-3 w-full rounded-xl bg-violet-500 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-600" onclick={retryLastMessage}>
								Retry
							</button>
						</div>
					{:else if queryError?.type === 'not_indexed'}
						<div class="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-700 max-w-md">
							<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
							<span>{queryError.message}</span>
						</div>
					{/if}
				</div>
			{:else}
				<!-- iMessage style thread -->
				<div class="mx-auto max-w-2xl space-y-3 px-4 py-6">
					{#each (chat.active?.messages ?? []) as msg (msg.id)}
						{#if msg.role === 'user'}
							<!-- User: right-aligned bubble -->
							<div class="flex justify-end">
								<div class="max-w-[75%] rounded-[20px] rounded-br-sm bg-linear-to-br from-pink-500 to-violet-600 px-4 py-2.5 shadow-sm">
									<p class="text-sm text-white">{msg.content}</p>
								</div>
							</div>
						{:else}
							<!-- AI: left-aligned with avatar -->
							<div class="flex items-end gap-2">
								<img src="/favicon.png" class="h-7 w-7 shrink-0 rounded-full object-cover shadow-sm" alt="Hivemind" />
								<div class="min-w-0 max-w-[78%]">
									<div class="ai-bubble rounded-[20px] rounded-bl-sm border border-gray-200/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html renderMarkdown(msg.content)}
									</div>
									{#if msg.sources && msg.sources.length > 0}
										<div class="mt-1.5 flex flex-wrap gap-1">
											{#each msg.sources as src (src)}
												<a href={sourceHref(src)} target="_blank" rel="noopener noreferrer"
													class="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50/80 px-2.5 py-1 text-[11px] font-medium text-violet-600 transition-colors hover:bg-violet-100">
													<ExternalLink class="h-2.5 w-2.5 shrink-0" />
													{sourceLabel(src)}
												</a>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{/if}
					{/each}

					{#if isLoading}
						<div class="flex items-end gap-2">
							<img src="/favicon.png" class="h-7 w-7 shrink-0 rounded-full object-cover shadow-sm" alt="Hivemind" />
							<div class="rounded-[20px] rounded-bl-sm border border-gray-200/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
								<div class="flex gap-1.5">
									<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]"></span>
									<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]"></span>
									<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]"></span>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- FAQ chips floating above input -->
		{#if faqs.length > 0 && !hasMessages}
			<div class="relative z-10 px-4 pb-2">
				<div class="mx-auto max-w-2xl">
					<div class="no-scrollbar flex gap-2 overflow-x-auto">
						{#each faqs.slice(0, 5) as faq (faq.id)}
							<button
								class="shrink-0 rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-xs text-gray-600 backdrop-blur-sm transition-all hover:border-violet-300 hover:bg-white hover:text-violet-700 whitespace-nowrap"
								onclick={() => useFaq(faq.question)}
							>
								{faq.question.length > 40 ? faq.question.slice(0, 40) + '…' : faq.question}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Input bar -->
		<div class="relative z-10 px-4 pb-5 pt-1">
			<div class="mx-auto max-w-2xl">
				<div class="input-bar flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white/70 px-4 py-1.5 shadow-sm backdrop-blur-sm transition-all duration-200">
					<Textarea
						bind:value={input}
						placeholder="Ask me anything about your projects"
						rows={1}
						class="no-scrollbar min-h-5 max-h-36 flex-1 resize-none border-0 bg-transparent px-0 py-1 text-sm leading-5 text-gray-700 shadow-none outline-none placeholder:text-gray-400 focus:outline-none focus-visible:ring-0"
						onkeydown={handleKeydown}
						oninput={(e) => {
							const el = e.currentTarget as HTMLTextAreaElement;
							el.style.height = 'auto';
							el.style.height = el.scrollHeight + 'px';
						}}
					/>
					<button
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-500 transition-all hover:border-violet-400 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
						disabled={!input.trim() || isLoading}
						onclick={handleSend}
						aria-label="Send"
					>
						{#if isLoading}
							<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
						{:else}
							<Send class="h-3.5 w-3.5" />
						{/if}
					</button>
				</div>
				<p class="mt-1.5 text-center text-[11px] text-gray-400">
					<kbd class="rounded bg-gray-100 px-1 py-0.5 text-[10px]">Enter</kbd> to send ·
					<kbd class="rounded bg-gray-100 px-1 py-0.5 text-[10px]">Shift+Enter</kbd> for new line
				</p>
			</div>
		</div>
	</div>
</div>

<style>
	/* ── AI bubble prose ──────────────────────────────────────────────── */
	:global(.ai-bubble) {
		font-size: 0.8125rem;
		line-height: 1.6;
		color: #374151;
	}

	/* Opening summary paragraph — slightly larger */
	:global(.ai-bubble > p:first-child) {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #1f2937;
		margin-bottom: 0.75rem;
	}

	:global(.ai-bubble p) { margin: 0.35em 0; }

	/* Section headings (##) */
	:global(.ai-bubble h2) {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: #6b7280;
		margin: 0.9em 0 0.3em;
		padding-bottom: 0.2em;
		border-bottom: 1px solid rgb(0 0 0 / 0.06);
	}
	:global(.ai-bubble h1, .ai-bubble h3) {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #1f2937;
		margin: 0.75em 0 0.25em;
	}

	/* Lists */
	:global(.ai-bubble ul, .ai-bubble ol) {
		margin: 0.3em 0;
		padding-left: 1.1em;
	}
	:global(.ai-bubble li) {
		margin: 0.15em 0;
		padding-left: 0.15em;
	}
	:global(.ai-bubble li::marker) { color: #a78bfa; }

	/* Inline code */
	:global(.ai-bubble code) {
		background: rgb(139 92 246 / 0.08);
		color: #7c3aed;
		border-radius: 0.3rem;
		padding: 0.1em 0.35em;
		font-size: 0.78rem;
		font-family: ui-monospace, monospace;
	}

	/* Code blocks */
	:global(.ai-bubble pre) {
		background: #f8f7ff;
		border: 1px solid rgb(139 92 246 / 0.12);
		border-radius: 0.75rem;
		padding: 0.75em 1em;
		overflow-x: auto;
		margin: 0.6em 0;
		font-size: 0.75rem;
	}
	:global(.ai-bubble pre code) { background: none; padding: 0; color: #374151; }

	/* Bold */
	:global(.ai-bubble strong) { font-weight: 700; color: #111827; }

	/* Links */
	:global(.ai-bubble a) { color: #7c3aed; text-decoration: underline; text-underline-offset: 2px; }

	/* ── Input focus ──────────────────────────────────────────────────── */
	.input-bar:focus-within {
		border-color: rgb(196 181 253 / 0.8);
		box-shadow: 0 0 0 3px rgb(196 181 253 / 0.25), 0 1px 3px rgb(0 0 0 / 0.06);
		outline: none;
	}
</style>
