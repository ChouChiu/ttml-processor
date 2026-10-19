import type { GeniusHit, ParsedLyricsData } from "../types";
import { parseLyricsHtml } from "./parser";

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
};

interface GeniusSearchResponse {
	response?: {
		sections?: Array<{
			type?: string;
			hits?: Array<{
				result?: {
					title?: string;
					full_title?: string;
					primary_artist?: { name?: string };
					url?: string;
				};
			}>;
		}>;
	};
}

const isRomanization = (hit: GeniusHit) =>
	hit.full_title.toLowerCase().includes("romaniz");
const isTranslation = (hit: GeniusHit) =>
	/translation|перевод/.test(hit.full_title.toLowerCase());

/** Fan-made romanizations and translations rather than the original song page */
function isDerivativeHit(hit: GeniusHit): boolean {
	return (
		hit.artist.toLowerCase().includes("genius") ||
		isRomanization(hit) ||
		isTranslation(hit)
	);
}

async function querySongs(query: string): Promise<GeniusHit[]> {
	const url = `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`;
	const res = await fetch(url, { headers: HEADERS });
	if (!res.ok) {
		throw new Error(`Genius search HTTP ${res.status}: ${res.statusText}`);
	}
	const data = (await res.json()) as GeniusSearchResponse;
	return (data.response?.sections ?? [])
		.filter((sec) => sec.type === "song")
		.flatMap((sec) => sec.hits ?? [])
		.flatMap(({ result: r }) =>
			r?.url
				? [
						{
							title: r.title ?? "",
							full_title: r.full_title ?? "",
							artist: r.primary_artist?.name ?? "",
							url: r.url,
						},
					]
				: [],
		);
}

/** Searches Genius songs, ranking original song pages ahead of derivative ones */
export async function searchGenius(query: string): Promise<GeniusHit[]> {
	const hits = await querySongs(query);
	const words = query.trim().split(/\s+/);

	// Two-word queries are often "title artist"; retry swapped when nothing useful came back
	if (words.length === 2 && hits.every(isDerivativeHit)) {
		const swapped = await querySongs(`${words[1]} ${words[0]}`).catch(() => []);
		const seen = new Set(hits.map((h) => h.url));
		hits.push(...swapped.filter((h) => !seen.has(h.url)));
	}

	return hits.sort(
		(a, b) => Number(isDerivativeHit(a)) - Number(isDerivativeHit(b)),
	);
}

/**
 * Picks the 1-based `index` candidate, skipping romanization and translation pages
 * unless the query asks for them
 */
export function pickCandidate(
	hits: GeniusHit[],
	query: string,
	index = 1,
): GeniusHit | undefined {
	const q = query.toLowerCase();
	const wantsRoman = q.includes("roman");
	const wantsTranslation = /translat/.test(q);
	const filtered = hits.filter(
		(h) =>
			(wantsRoman || !isRomanization(h)) &&
			(wantsTranslation || !isTranslation(h)),
	);
	const candidates = filtered.length > 0 ? filtered : hits;
	return candidates[Math.max(0, Math.min(index - 1, candidates.length - 1))];
}

export async function scrapeGeniusLyrics(
	pageUrl: string,
): Promise<ParsedLyricsData> {
	const res = await fetch(pageUrl, { headers: HEADERS });
	if (!res.ok) {
		throw new Error(
			`Failed to fetch lyrics HTTP ${res.status}: ${res.statusText}`,
		);
	}
	return parseLyricsHtml(await res.text(), pageUrl);
}
