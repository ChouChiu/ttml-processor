/**
 * Timestamp parsing, formatting, and boundary arithmetic for TTML lyric synchronization.
 */

/**
 * Parses a TTML timestamp string (seconds, MM:SS.mmm, or HH:MM:SS.mmm) into milliseconds.
 * Returns null if the format is invalid or undefined.
 */
export function parseTimestampToMs(value?: string): number | null {
	if (!value) return null;
	const parts = value.trim().replace(/s$/, "").split(":");
	if (parts.length > 3 || !parts.every((p) => /^\d+(?:\.\d+)?$/.test(p))) {
		return null;
	}
	return parts.reduce((total, p) => total * 60 + Number(p), 0) * 1000;
}

/**
 * Formats a millisecond timestamp preserving the template's format
 * (clock MM:SS.mmm or seconds S.mmm), using exact integer arithmetic.
 */
export function formatTimestamp(ms: number, template = "0:00.000"): string {
	const totalMs = Math.round(ms);
	if (template.includes(":")) {
		const minutes = Math.floor(totalMs / 60000);
		const remMs = totalMs % 60000;
		const secs = Math.floor(remMs / 1000);
		const millis = remMs % 1000;
		return `${minutes}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
	}
	return (totalMs / 1000).toFixed(3);
}

/**
 * Checks whether begin and end timestamps are reversed (begin > end).
 */
export function isReversed(begin?: string, end?: string): boolean {
	const b = parseTimestampToMs(begin);
	const e = parseTimestampToMs(end);
	return b !== null && e !== null && b > e;
}
