import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	ApiError,
	fetchHealth,
	sendQuery,
	fetchFAQs,
	crawlURL,
	type HealthResponse,
	type QueryResponse,
	type FAQsResponse,
	type CrawlResponse
} from './api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown, ok?: boolean): void {
	const isOk = ok ?? (status >= 200 && status < 300);
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok: isOk,
			status,
			statusText: String(status),
			json: vi.fn().mockResolvedValue(body)
		})
	);
}

function mockFetchNetworkError(): void {
	vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
}

// ── ApiError ──────────────────────────────────────────────────────────────────

describe('ApiError', () => {
	it('is an instance of Error', () => {
		const err = new ApiError('something went wrong', 500);
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(ApiError);
	});

	it('exposes status and message', () => {
		const err = new ApiError('not found', 404);
		expect(err.message).toBe('not found');
		expect(err.status).toBe(404);
	});

	it('supports every HTTP status code', () => {
		expect(new ApiError('conflict', 409).status).toBe(409);
		expect(new ApiError('unprocessable', 422).status).toBe(422);
		expect(new ApiError('server error', 500).status).toBe(500);
	});
});

// ── fetchHealth ───────────────────────────────────────────────────────────────

describe('fetchHealth', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('returns a healthy response', async () => {
		const payload: HealthResponse = {
			success: true,
			status: 'healthy',
			checks: { database: 'ok', pinecone: 'ok', openai: 'configured' }
		};
		mockFetch(200, payload);

		const result = await fetchHealth();
		expect(result).toEqual(payload);
	});

	it('returns a degraded response without throwing', async () => {
		const payload: HealthResponse = {
			success: false,
			status: 'degraded',
			checks: { database: 'error: could not connect', pinecone: 'ok', openai: 'configured' }
		};
		// fetchHealth does not check res.ok — it just returns json
		mockFetch(503, payload, false);

		const result = await fetchHealth();
		expect(result.status).toBe('degraded');
	});

	it('hits the correct endpoint', async () => {
		mockFetch(200, { success: true, status: 'healthy', checks: {} });
		await fetchHealth();
		const fetchMock = vi.mocked(globalThis.fetch);
		expect(fetchMock).toHaveBeenCalledWith('https://hivemind-2f75.onrender.com/health');
	});
});

// ── sendQuery ─────────────────────────────────────────────────────────────────

describe('sendQuery', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('returns a QueryResponse on success', async () => {
		const payload: QueryResponse = {
			answer: 'Here is the answer.',
			sources: ['https://docs.example.com/page'],
			conversation_id: 'abc-123',
			namespace: 'docs_example_com'
		};
		mockFetch(200, payload);

		const result = await sendQuery({ question: 'How do I do X?' });
		expect(result).toEqual(payload);
	});

	it('sends POST with JSON body and correct headers', async () => {
		mockFetch(200, {
			answer: '',
			sources: [],
			conversation_id: 'x',
			namespace: null
		});

		await sendQuery({
			question: 'test question',
			url: 'https://docs.example.com',
			conversation_id: 'conv-1'
		});

		const fetchMock = vi.mocked(globalThis.fetch);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://hivemind-2f75.onrender.com/api/v1/query');
		expect(init.method).toBe('POST');
		expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
		expect(JSON.parse(init.body as string)).toEqual({
			question: 'test question',
			url: 'https://docs.example.com',
			conversation_id: 'conv-1'
		});
	});

	it('throws ApiError with status 404 when not indexed', async () => {
		mockFetch(404, { error: 'URL not indexed' }, false);

		await expect(sendQuery({ question: 'anything' })).rejects.toMatchObject({
			status: 404,
			message: 'URL not indexed'
		});
	});

	it('throws ApiError with status 422 for validation errors', async () => {
		mockFetch(422, { error: 'Validation failed' }, false);

		const err = await sendQuery({ question: '' }).catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(422);
	});

	it('falls back to a default message when error body has no "error" field', async () => {
		mockFetch(500, {}, false);

		const err = await sendQuery({ question: 'q' }).catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.message).toBe('Query failed');
	});

	it('falls back gracefully when error body is not JSON', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				json: vi.fn().mockRejectedValue(new SyntaxError('not json'))
			})
		);

		const err = await sendQuery({ question: 'q' }).catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(500);
	});
});

// ── fetchFAQs ─────────────────────────────────────────────────────────────────

describe('fetchFAQs', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('returns a FAQsResponse on success', async () => {
		const payload: FAQsResponse = {
			faqs: [
				{
					id: 1,
					question: 'How do I set up on-call schedules?',
					answer: '## Steps\n1. ...',
					frequency: 24,
					generated_at: '2026-03-31T18:00:00.000Z'
				}
			],
			total: 1
		};
		mockFetch(200, payload);

		const result = await fetchFAQs();
		expect(result).toEqual(payload);
	});

	it('hits the correct endpoint', async () => {
		mockFetch(200, { faqs: [], total: 0 });
		await fetchFAQs();
		expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
			'https://hivemind-2f75.onrender.com/api/v1/faqs'
		);
	});

	it('throws ApiError on non-ok response', async () => {
		mockFetch(503, { error: 'Service unavailable' }, false);

		const err = await fetchFAQs().catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(503);
		expect(err.message).toBe('Failed to load FAQs');
	});
});

// ── crawlURL ──────────────────────────────────────────────────────────────────

describe('crawlURL', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('returns a CrawlResponse (202) on success', async () => {
		const payload: CrawlResponse = {
			message: 'Crawl accepted',
			url: 'https://docs.example.com',
			response: 'Crawling, embedding, and indexing will complete in the background.'
		};
		mockFetch(202, payload);

		const result = await crawlURL('https://docs.example.com');
		expect(result).toEqual(payload);
	});

	it('sends POST with the URL in the body', async () => {
		mockFetch(202, { message: 'Crawl accepted', url: '', response: '' });

		await crawlURL('https://docs.example.com');

		const fetchMock = vi.mocked(globalThis.fetch);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://hivemind-2f75.onrender.com/api/v1/crawl');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body as string)).toEqual({ url: 'https://docs.example.com' });
	});

	it('throws ApiError with status 409 when URL is already indexed', async () => {
		mockFetch(409, { error: 'URL already indexed (namespace=docs_example_com, chunks=312)' }, false);

		const err = await crawlURL('https://docs.example.com').catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(409);
		expect(err.message).toContain('already indexed');
	});

	it('throws ApiError with status 400 for SSRF-guarded URLs', async () => {
		mockFetch(400, { error: 'URL resolves to a non-public address (192.168.1.1)' }, false);

		const err = await crawlURL('http://192.168.1.1').catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(400);
	});

	it('throws ApiError with status 422 for an invalid URL', async () => {
		mockFetch(422, { error: 'url: URL scheme should be \'http\' or \'https\'' }, false);

		const err = await crawlURL('not-a-url').catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(422);
	});

	it('falls back to a default message when error body has no "error" field', async () => {
		mockFetch(500, {}, false);

		const err = await crawlURL('https://docs.example.com').catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.message).toBe('Crawl failed');
	});

	it('falls back gracefully when error body is not JSON', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				json: vi.fn().mockRejectedValue(new SyntaxError('not json'))
			})
		);

		const err = await crawlURL('https://docs.example.com').catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(500);
	});

	it('propagates a network-level TypeError', async () => {
		mockFetchNetworkError();

		await expect(crawlURL('https://docs.example.com')).rejects.toBeInstanceOf(TypeError);
	});
});
