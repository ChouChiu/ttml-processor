export async function fetchJson<T>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(url, init);
	if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
	return (await res.json()) as T;
}

/** Formats a millisecond timestamp as YYYY-MM-DD, or "" when unknown */
export function isoDate(ms?: number | null): string {
	return ms ? new Date(ms).toISOString().slice(0, 10) : "";
}
