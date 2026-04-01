/**
 * Converts a source string (either a real URL or a scraped file path) into a
 * linkable href.
 *
 * Scraped file path format:
 *   scraped_websites/<domain_with_underscores>/<slug_with_underscores>.txt
 *
 * Example:
 *   "scraped_websites/support_squadcast_com/adding_a_schedule.txt"
 *   → "https://support.squadcast.com/adding-a-schedule"
 */
export function sourceHref(src: string): string {
	try {
		new URL(src);
		return src; // Already a full URL
	} catch {
		const parts = src.replace(/\\/g, '/').split('/');
		// parts[0] = "scraped_websites", parts[1] = domain folder, parts[2+] = path segments
		const domainPart = parts[1];
		const filePart = parts[parts.length - 1];
		if (!domainPart || !filePart) return '#';
		const domain = domainPart.replace(/_/g, '.');
		const slug = filePart.replace(/\.[^.]+$/, '').replace(/_/g, '-');
		return `https://${domain}/${slug}`;
	}
}

/**
 * Returns a short human-readable label for a source.
 *
 * - Real URLs  → hostname (e.g. "support.squadcast.com")
 * - File paths → filename without extension, underscores replaced with spaces
 *               (e.g. "adding a schedule")
 */
export function sourceLabel(src: string): string {
	try {
		return new URL(src).hostname;
	} catch {
		const parts = src.replace(/\\/g, '/').split('/');
		const file = parts[parts.length - 1] ?? src;
		return file.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
	}
}
