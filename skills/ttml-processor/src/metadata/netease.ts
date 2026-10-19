import type { SongCandidate, SongMetadata } from "../types";
import { parseLyricCredits, songwritersFrom } from "./credits";
import { fetchJson, isoDate } from "./http";

const BASE = "https://music.163.com/api";
const HEADERS = {
	Referer: "https://music.163.com/",
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

interface NeteaseSong {
	id: number;
	name?: string;
	ar?: { name?: string }[];
	al?: { name?: string };
	dt?: number;
	publishTime?: number;
}

interface CodeResponse {
	code?: number;
}

function assertOk(res: CodeResponse, action: string): void {
	if (res.code !== undefined && res.code !== 200) {
		throw new Error(`NetEase ${action} failed: code ${res.code}`);
	}
}

export function toCandidate(song: NeteaseSong): SongCandidate {
	return {
		source: "netease",
		id: String(song.id),
		title: song.name ?? "",
		artists: (song.ar ?? []).flatMap((a) => (a.name ? [a.name] : [])),
		album: song.al?.name ?? "",
		releaseDate: isoDate(song.publishTime),
		durationMs: song.dt ?? 0,
	};
}

/** Uses the plain cloudsearch endpoint, since the web search endpoint is encrypted outside mainland China */
export async function searchNetease(query: string): Promise<SongCandidate[]> {
	const params = new URLSearchParams({ s: query, type: "1", limit: "10" });
	const res = await fetchJson<
		CodeResponse & { result?: { songs?: NeteaseSong[] } }
	>(`${BASE}/cloudsearch/pc?${params}`, { headers: HEADERS });
	assertOk(res, "search");
	return (res.result?.songs ?? []).map(toCandidate);
}

export async function fetchNeteaseMetadata(id: string): Promise<SongMetadata> {
	const ids = encodeURIComponent(JSON.stringify([{ id: Number(id) }]));
	const detail = await fetchJson<CodeResponse & { songs?: NeteaseSong[] }>(
		`${BASE}/v3/song/detail?c=${ids}`,
		{ headers: HEADERS },
	);
	assertOk(detail, "song detail");
	const song = detail.songs?.[0];
	if (!song) throw new Error(`NetEase song ${id} not found`);

	const lyric = await fetchJson<CodeResponse & { lrc?: { lyric?: string } }>(
		`${BASE}/song/lyric?id=${encodeURIComponent(id)}&lv=1&tv=-1`,
		{ headers: HEADERS },
	);
	const credits = parseLyricCredits(lyric.lrc?.lyric ?? "");

	return {
		...toCandidate(song),
		url: `https://music.163.com/#/song?id=${id}`,
		credits,
		songwriters: songwritersFrom(credits),
		amllMeta: { ncmMusicId: id },
	};
}
