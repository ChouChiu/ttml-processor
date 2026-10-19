import type { SongCandidate, SongMetadata } from "../types";
import { parseLyricCredits, songwritersFrom } from "./credits";
import { fetchJson } from "./http";

const MUSICU_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const LYRIC_URL = "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg";

/** Anonymous QQ Music Lite client identity, as used by Lyrics-Helper */
const COMM = {
	ct: 11,
	cv: "1003006",
	v: "1003006",
	os_ver: "15",
	phonetype: "24122RKC7C",
	tmeAppID: "qqmusiclight",
	nettype: "NETWORK_WIFI",
	udid: "0",
	uid: "0",
};

interface QqTrack {
	mid: string;
	title?: string;
	name?: string;
	singer?: { name?: string }[];
	album?: { name?: string };
	time_public?: string;
	interval?: number;
}

interface MusicuResponse<T> {
	code?: number;
	request?: { code?: number; data?: T };
}

async function musicu<T>(
	module: string,
	method: string,
	param: Record<string, unknown>,
): Promise<T> {
	const res = await fetchJson<MusicuResponse<T>>(MUSICU_URL, {
		method: "POST",
		headers: {
			"User-Agent": "okhttp/3.14.9",
			Cookie: "tmeLoginType=-1;",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ comm: COMM, request: { module, method, param } }),
	});
	const code = res.code || res.request?.code;
	if (code || !res.request?.data) {
		throw new Error(`QQ Music ${method} failed: code ${code ?? "no data"}`);
	}
	return res.request.data;
}

export function toCandidate(track: QqTrack): SongCandidate {
	return {
		source: "qq",
		id: track.mid,
		title: track.title || track.name || "",
		artists: (track.singer ?? []).flatMap((s) => (s.name ? [s.name] : [])),
		album: track.album?.name ?? "",
		releaseDate: track.time_public ?? "",
		durationMs: (track.interval ?? 0) * 1000,
	};
}

export async function searchQq(query: string): Promise<SongCandidate[]> {
	const data = await musicu<{ body?: { item_song?: QqTrack[] } }>(
		"music.search.SearchCgiService",
		"DoSearchForQQMusicMobile",
		{
			search_id: String(Date.now()),
			remoteplace: "search.android.keyboard",
			query,
			search_type: 0,
			num_per_page: 10,
			page_num: 1,
			highlight: 0,
			nqc_flag: 0,
			page_id: 1,
			grp: 1,
		},
	);
	return (data.body?.item_song ?? []).map(toCandidate);
}

/** Plain LRC with credit lines; the newer endpoint only serves encrypted QRC */
async function fetchLrc(mid: string): Promise<string> {
	const params = new URLSearchParams({
		songmid: mid,
		format: "json",
		nobase64: "1",
		g_tk: "5381",
	});
	const res = await fetchJson<{ lyric?: string }>(`${LYRIC_URL}?${params}`, {
		headers: { Referer: "https://y.qq.com/", "User-Agent": "Mozilla/5.0" },
	});
	return res.lyric ?? "";
}

export async function fetchQqMetadata(mid: string): Promise<SongMetadata> {
	const [detail, lrc] = await Promise.all([
		musicu<{ track_info?: QqTrack }>(
			"music.pf_song_detail_svr",
			"get_song_detail_yqq",
			{ song_mid: mid },
		),
		fetchLrc(mid).catch(() => ""),
	]);
	if (!detail.track_info?.mid)
		throw new Error(`QQ Music song ${mid} not found`);

	const credits = parseLyricCredits(lrc);
	return {
		...toCandidate(detail.track_info),
		url: `https://y.qq.com/n/ryqq/songDetail/${mid}`,
		credits,
		songwriters: songwritersFrom(credits),
		amllMeta: { qqMusicId: mid },
	};
}
