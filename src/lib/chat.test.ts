/**
 * Tests for the chat store (chat.svelte.ts).
 *
 * NOTE: .svelte.ts files use Svelte 5 runes ($state, $derived).  These are
 * compile-time transforms handled by the Svelte compiler.  The tests below
 * require vitest to be run through the SvelteKit vite plugin so that runes are
 * transpiled before execution.  See vitest.config.ts for the setup.
 *
 * Install:  bun add -D vitest
 * Run:      bunx vitest run
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { chat } from './chat.svelte';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Remove every conversation so each test starts from a clean slate. */
function resetStore(): void {
	const ids = chat.conversations.map((c) => c.id);
	for (const id of ids) chat.deleteConversation(id);
}

// ── newConversation ───────────────────────────────────────────────────────────

describe('newConversation', () => {
	beforeEach(resetStore);

	it('creates a conversation and returns its id', () => {
		const id = chat.newConversation();
		expect(typeof id).toBe('string');
		expect(id.length).toBeGreaterThan(0);
	});

	it('adds the conversation to the list', () => {
		const id = chat.newConversation();
		expect(chat.conversations.some((c) => c.id === id)).toBe(true);
	});

	it('sets the new conversation as active', () => {
		const id = chat.newConversation();
		expect(chat.activeId).toBe(id);
	});

	it('prepends the new conversation so it appears first', () => {
		const first = chat.newConversation();
		const second = chat.newConversation();
		expect(chat.conversations[0].id).toBe(second);
		expect(chat.conversations[1].id).toBe(first);
	});

	it('titles the conversation "New conversation"', () => {
		const id = chat.newConversation();
		const conv = chat.conversations.find((c) => c.id === id);
		expect(conv?.title).toBe('New conversation');
	});

	it('starts with an empty messages array', () => {
		const id = chat.newConversation();
		const conv = chat.conversations.find((c) => c.id === id);
		expect(conv?.messages).toHaveLength(0);
	});
});

// ── addMessage ────────────────────────────────────────────────────────────────

describe('addMessage', () => {
	beforeEach(resetStore);

	it('appends a user message to the conversation', () => {
		const id = chat.newConversation();
		chat.addMessage(id, { role: 'user', content: 'Hello?' });

		const conv = chat.conversations.find((c) => c.id === id)!;
		expect(conv.messages).toHaveLength(1);
		expect(conv.messages[0].role).toBe('user');
		expect(conv.messages[0].content).toBe('Hello?');
	});

	it('assigns a unique id and a timestamp to each message', () => {
		const id = chat.newConversation();
		chat.addMessage(id, { role: 'user', content: 'first' });
		chat.addMessage(id, { role: 'assistant', content: 'second' });

		const { messages } = chat.conversations.find((c) => c.id === id)!;
		expect(messages[0].id).toBeTruthy();
		expect(messages[1].id).toBeTruthy();
		expect(messages[0].id).not.toBe(messages[1].id);
		expect(messages[0].timestamp).toBeInstanceOf(Date);
	});

	it('auto-titles the conversation from the first user message', () => {
		const id = chat.newConversation();
		chat.addMessage(id, { role: 'user', content: 'How do I set up on-call schedules?' });

		const conv = chat.conversations.find((c) => c.id === id)!;
		expect(conv.title).toBe('How do I set up on-call schedules?');
	});

	it('truncates the auto-title at 50 characters', () => {
		const id = chat.newConversation();
		const longMessage = 'A'.repeat(80);
		chat.addMessage(id, { role: 'user', content: longMessage });

		const conv = chat.conversations.find((c) => c.id === id)!;
		expect(conv.title).toHaveLength(50);
	});

	it('does not update the title after the first message', () => {
		const id = chat.newConversation();
		chat.addMessage(id, { role: 'user', content: 'First question' });
		chat.addMessage(id, { role: 'assistant', content: 'An answer' });
		chat.addMessage(id, { role: 'user', content: 'A totally different question' });

		const conv = chat.conversations.find((c) => c.id === id)!;
		expect(conv.title).toBe('First question');
	});

	it('does not set the title when the first message is from the assistant', () => {
		const id = chat.newConversation();
		chat.addMessage(id, { role: 'assistant', content: 'Welcome!' });

		const conv = chat.conversations.find((c) => c.id === id)!;
		expect(conv.title).toBe('New conversation');
	});

	it('stores optional sources on assistant messages', () => {
		const id = chat.newConversation();
		chat.addMessage(id, {
			role: 'assistant',
			content: 'Here is info.',
			sources: ['https://docs.example.com/page']
		});

		const { messages } = chat.conversations.find((c) => c.id === id)!;
		expect(messages[0].sources).toEqual(['https://docs.example.com/page']);
	});

	it('ignores addMessage when the convId does not exist', () => {
		chat.newConversation();
		const before = chat.conversations.map((c) => ({ ...c }));
		chat.addMessage('non-existent-id', { role: 'user', content: 'ghost' });
		expect(chat.conversations).toHaveLength(before.length);
	});
});

// ── removeLastMessage ─────────────────────────────────────────────────────────

describe('removeLastMessage', () => {
	beforeEach(resetStore);

	it('removes the last message', () => {
		const id = chat.newConversation();
		chat.addMessage(id, { role: 'user', content: 'first' });
		chat.addMessage(id, { role: 'user', content: 'second' });
		chat.removeLastMessage(id);

		const { messages } = chat.conversations.find((c) => c.id === id)!;
		expect(messages).toHaveLength(1);
		expect(messages[0].content).toBe('first');
	});

	it('is a no-op on an empty messages array', () => {
		const id = chat.newConversation();
		expect(() => chat.removeLastMessage(id)).not.toThrow();
		expect(chat.conversations.find((c) => c.id === id)?.messages).toHaveLength(0);
	});

	it('is a no-op when convId does not exist', () => {
		const id = chat.newConversation();
		chat.addMessage(id, { role: 'user', content: 'keep me' });
		chat.removeLastMessage('non-existent-id');

		expect(chat.conversations.find((c) => c.id === id)?.messages).toHaveLength(1);
	});
});

// ── deleteConversation ────────────────────────────────────────────────────────

describe('deleteConversation', () => {
	beforeEach(resetStore);

	it('removes the conversation from the list', () => {
		const id = chat.newConversation();
		chat.deleteConversation(id);
		expect(chat.conversations.some((c) => c.id === id)).toBe(false);
	});

	it('updates activeId to the next conversation when the active one is deleted', () => {
		const first = chat.newConversation();
		const second = chat.newConversation(); // becomes active
		chat.deleteConversation(second);
		// conversations list had [second, first]; after delete → [first]
		expect(chat.activeId).toBe(first);
	});

	it('sets activeId to null when the last conversation is deleted', () => {
		const id = chat.newConversation();
		chat.deleteConversation(id);
		expect(chat.activeId).toBeNull();
	});

	it('does not change activeId when a non-active conversation is deleted', () => {
		const first = chat.newConversation();
		const second = chat.newConversation(); // active
		chat.deleteConversation(first);
		expect(chat.activeId).toBe(second);
	});
});

// ── setConversationId ─────────────────────────────────────────────────────────

describe('setConversationId', () => {
	beforeEach(resetStore);

	it('stores the backend conversationId on the conversation', () => {
		const id = chat.newConversation();
		chat.setConversationId(id, 'backend-uuid-999');

		const conv = chat.conversations.find((c) => c.id === id)!;
		expect(conv.conversationId).toBe('backend-uuid-999');
	});

	it('does not affect other conversations', () => {
		const a = chat.newConversation();
		const b = chat.newConversation();
		chat.setConversationId(a, 'uuid-for-a');

		expect(chat.conversations.find((c) => c.id === b)?.conversationId).toBeUndefined();
	});
});

// ── setScopeUrl ───────────────────────────────────────────────────────────────

describe('setScopeUrl', () => {
	beforeEach(resetStore);

	it('stores the scopeUrl on the conversation', () => {
		const id = chat.newConversation();
		chat.setScopeUrl(id, 'https://docs.example.com');

		const conv = chat.conversations.find((c) => c.id === id)!;
		expect(conv.scopeUrl).toBe('https://docs.example.com');
	});

	it('can update the scopeUrl after it has already been set', () => {
		const id = chat.newConversation();
		chat.setScopeUrl(id, 'https://first.example.com');
		chat.setScopeUrl(id, 'https://second.example.com');

		expect(chat.conversations.find((c) => c.id === id)?.scopeUrl).toBe(
			'https://second.example.com'
		);
	});

	it('does not affect other conversations', () => {
		const a = chat.newConversation();
		const b = chat.newConversation();
		chat.setScopeUrl(a, 'https://docs.example.com');

		expect(chat.conversations.find((c) => c.id === b)?.scopeUrl).toBeUndefined();
	});
});

// ── active (derived) ──────────────────────────────────────────────────────────

describe('active derived value', () => {
	beforeEach(resetStore);

	it('returns null when there are no conversations', () => {
		expect(chat.active).toBeNull();
	});

	it('returns the active conversation', () => {
		const id = chat.newConversation();
		expect(chat.active?.id).toBe(id);
	});

	it('returns null after the active conversation is deleted', () => {
		const id = chat.newConversation();
		chat.deleteConversation(id);
		expect(chat.active).toBeNull();
	});
});
