export interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	sources?: string[];
	timestamp: Date;
}

export interface Conversation {
	id: string;
	title: string;
	messages: Message[];
	conversationId?: string;
	scopeUrl?: string;
	createdAt: Date;
}

function generateId() {
	return Math.random().toString(36).slice(2, 11);
}

function createChatStore() {
	let conversations = $state<Conversation[]>([]);
	let activeId = $state<string | null>(null);

	const active = $derived(conversations.find((c) => c.id === activeId) ?? null);

	function newConversation(): string {
		const id = generateId();
		conversations = [
			{
				id,
				title: 'New conversation',
				messages: [],
				createdAt: new Date()
			},
			...conversations
		];
		activeId = id;
		return id;
	}

	function setActive(id: string) {
		activeId = id;
	}

	function addMessage(convId: string, msg: Omit<Message, 'id' | 'timestamp'>) {
		conversations = conversations.map((c) => {
			if (c.id !== convId) return c;
			const newMsg: Message = { ...msg, id: generateId(), timestamp: new Date() };
			const messages = [...c.messages, newMsg];
			// Auto-title from first user message
			const title =
				c.messages.length === 0 && msg.role === 'user'
					? msg.content.slice(0, 50)
					: c.title;
			return { ...c, messages, title };
		});
	}

	function setConversationId(convId: string, backendId: string) {
		conversations = conversations.map((c) =>
			c.id === convId ? { ...c, conversationId: backendId } : c
		);
	}

	function setScopeUrl(convId: string, url: string) {
		conversations = conversations.map((c) =>
			c.id === convId ? { ...c, scopeUrl: url } : c
		);
	}

	function removeLastMessage(convId: string) {
		conversations = conversations.map((c) => {
			if (c.id !== convId) return c;
			return { ...c, messages: c.messages.slice(0, -1) };
		});
	}

	function deleteConversation(id: string) {
		conversations = conversations.filter((c) => c.id !== id);
		if (activeId === id) {
			activeId = conversations[0]?.id ?? null;
		}
	}

	return {
		get conversations() { return conversations; },
		get active() { return active; },
		get activeId() { return activeId; },
		newConversation,
		setActive,
		addMessage,
		removeLastMessage,
		setConversationId,
		setScopeUrl,
		deleteConversation
	};
}

export const chat = createChatStore();
