import { describe, it, expect } from 'vitest';
import { sourceHref, sourceLabel } from './source-url';

// ── sourceHref ────────────────────────────────────────────────────────────────

describe('sourceHref', () => {
	// ── Scraped file paths ────────────────────────────────────────────────────

	it('converts a scraped path to a real URL (basic)', () => {
		expect(sourceHref('scraped_websites/support_squadcast_com/adding_a_schedule.txt')).toBe(
			'https://support.squadcast.com/adding-a-schedule'
		);
	});

	it('converts underscored domain folder to dot-separated hostname', () => {
		expect(sourceHref('scraped_websites/docs_example_com/getting_started.txt')).toBe(
			'https://docs.example.com/getting-started'
		);
	});

	it('strips the file extension from the slug', () => {
		expect(sourceHref('scraped_websites/help_center_io/faq_page.md')).toBe(
			'https://help.center.io/faq-page'
		);
	});

	it('handles SAML-style filenames with numbers and underscores', () => {
		expect(
			sourceHref('scraped_websites/support_squadcast_com/saml_2_0_based_sso.txt')
		).toBe('https://support.squadcast.com/saml-2-0-based-sso');
	});

	it('handles Windows-style backslash separators', () => {
		expect(
			sourceHref('scraped_websites\\support_squadcast_com\\adding_a_schedule.txt')
		).toBe('https://support.squadcast.com/adding-a-schedule');
	});

	it('handles deeply nested paths (only domain + last segment are used)', () => {
		expect(
			sourceHref('scraped_websites/support_squadcast_com/section/sub/page_name.txt')
		).toBe('https://support.squadcast.com/page-name');
	});

	it('returns "#" when the domain part is missing', () => {
		expect(sourceHref('scraped_websites/')).toBe('#');
	});

	it('returns "#" when both domain and filename are missing', () => {
		expect(sourceHref('')).toBe('#');
	});

	// ── Real URLs ─────────────────────────────────────────────────────────────

	it('passes through a real https URL unchanged', () => {
		const url = 'https://docs.example.com/schedules/create';
		expect(sourceHref(url)).toBe(url);
	});

	it('passes through a real http URL unchanged', () => {
		const url = 'http://localhost:3000/page';
		expect(sourceHref(url)).toBe(url);
	});

	it('passes through a URL with query parameters unchanged', () => {
		const url = 'https://example.com/search?q=schedules&page=2';
		expect(sourceHref(url)).toBe(url);
	});

	it('passes through a URL with a hash fragment unchanged', () => {
		const url = 'https://docs.example.com/guide#section-2';
		expect(sourceHref(url)).toBe(url);
	});
});

// ── sourceLabel ───────────────────────────────────────────────────────────────

describe('sourceLabel', () => {
	// ── Scraped file paths ────────────────────────────────────────────────────

	it('returns a human-readable label from a scraped filename', () => {
		expect(
			sourceLabel('scraped_websites/support_squadcast_com/adding_a_schedule.txt')
		).toBe('adding a schedule');
	});

	it('removes the file extension', () => {
		expect(sourceLabel('scraped_websites/docs_example_com/getting_started.md')).toBe(
			'getting started'
		);
	});

	it('replaces all underscores with spaces', () => {
		expect(
			sourceLabel('scraped_websites/support_squadcast_com/saml_2_0_based_sso.txt')
		).toBe('saml 2 0 based sso');
	});

	it('handles Windows-style backslash paths', () => {
		expect(
			sourceLabel('scraped_websites\\support_squadcast_com\\on_call_schedules.txt')
		).toBe('on call schedules');
	});

	// ── Real URLs ─────────────────────────────────────────────────────────────

	it('returns the hostname for a real https URL', () => {
		expect(sourceLabel('https://support.squadcast.com/adding-a-schedule')).toBe(
			'support.squadcast.com'
		);
	});

	it('returns the hostname for a URL with a path', () => {
		expect(sourceLabel('https://docs.example.com/schedules/create')).toBe('docs.example.com');
	});

	it('returns the hostname for a URL with query params', () => {
		expect(sourceLabel('https://example.com/search?q=test')).toBe('example.com');
	});

	it('returns the hostname for a URL with a port', () => {
		expect(sourceLabel('http://localhost:8000/api/v1/docs')).toBe('localhost');
	});
});
