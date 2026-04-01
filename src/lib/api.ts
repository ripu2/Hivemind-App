const BASE_URL = 'https://hivemind-2f75.onrender.com';

// ── Typed API error ───────────────────────────────────────────────────────────
export class ApiError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
	}
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface HealthResponse {
	success: boolean;
	status: 'healthy' | 'degraded';
	checks: {
		database: string;
		pinecone: string;
		openai: string;
	};
}

export interface QueryRequest {
	question: string;
	url?: string;
	conversation_id?: string;
}

export interface QueryResponse {
	answer: string;
	sources: string[];
	conversation_id: string;
	namespace: string | null;
}

export interface FAQsResponse {
	faqs: {
		id: number;
		question: string;
		answer: string;
		frequency: number;
		generated_at: string;
	}[];
	total: number;
}

export interface CrawlResponse {
	message: string;
	url: string;
	response: string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────
export async function fetchHealth(): Promise<HealthResponse> {
	const res = await fetch(`${BASE_URL}/health`);
	return res.json();
}

export async function sendQuery(req: QueryRequest): Promise<QueryResponse> {
	const res = await fetch(`${BASE_URL}/api/v1/query`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(req)
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }));
		throw new ApiError(body.error ?? 'Query failed', res.status);
	}
	return res.json();
}

export async function fetchFAQs(): Promise<FAQsResponse> {
	const res = await fetch(`${BASE_URL}/api/v1/faqs`);
	if (!res.ok) throw new ApiError('Failed to load FAQs', res.status);
	return res.json();
}

export async function crawlURL(url: string): Promise<CrawlResponse> {
	const res = await fetch(`${BASE_URL}/api/v1/crawl`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url })
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }));
		throw new ApiError(body.error ?? 'Crawl failed', res.status);
	}
	return res.json();
}
