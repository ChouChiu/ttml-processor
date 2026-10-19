import type {
	MetadataSource,
	SongCandidate,
	SongMetadata,
	WorkspaceMeta,
} from "../types";
import { songwritersFrom } from "./credits";
import { fetchNeteaseMetadata, searchNetease } from "./netease";
import { fetchQqMetadata, searchQq } from "./qq";

export { parseLyricCredits, songwritersFrom } from "./credits";

export interface MetadataProvider {
	name: string;
	search(query: string): Promise<SongCandidate[]>;
	fetch(id: string): Promise<SongMetadata>;
}

/** Listed in merge priority: QQ Music first, NetEase as fallback */
export const PROVIDERS: Record<MetadataSource, MetadataProvider> = {
	qq: { name: "QQ Music", search: searchQq, fetch: fetchQqMetadata },
	netease: {
		name: "NetEase Cloud Music",
		search: searchNetease,
		fetch: fetchNeteaseMetadata,
	},
};

export const METADATA_SOURCES = Object.keys(PROVIDERS) as MetadataSource[];

const SONG_URL_PATTERNS: [MetadataSource, RegExp][] = [
	["netease", /music\.163\.com\/.*song.*[?&]id=(\d+)/],
	["qq", /y\.qq\.com\/n\/ryqq\/songDetail\/(\w+)/],
	["qq", /y\.qq\.com\/.*[?&]songmid=(\w+)/],
];

/** Recognizes NetEase and QQ Music song page URLs */
export function parseSongUrl(
	input: string,
): { source: MetadataSource; id: string } | null {
	for (const [source, re] of SONG_URL_PATTERNS) {
		const id = re.exec(input)?.[1];
		if (id) return { source, id };
	}
	return null;
}

/**
 * Combines metadata from several platforms: descriptive fields and credits prefer the
 * first entry, later entries only fill gaps, and platform ids are collected from all
 */
export function mergeSongMetadata(songs: SongMetadata[]): SongMetadata {
	const [primary, ...rest] = songs;
	if (!primary) throw new Error("No song metadata to merge");
	const merged: SongMetadata = {
		...primary,
		credits: { ...primary.credits },
		amllMeta: { ...primary.amllMeta },
	};
	for (const song of rest) {
		for (const [label, names] of Object.entries(song.credits)) {
			merged.credits[label] ??= names;
		}
		merged.amllMeta = { ...song.amllMeta, ...merged.amllMeta };
		merged.album ||= song.album;
		merged.releaseDate ||= song.releaseDate;
	}
	merged.songwriters = songwritersFrom(merged.credits);
	return merged;
}

/**
 * Fills workspace metadata from a fetched song; existing values are kept unless
 * `overwrite` is set, and platform ids are always added
 */
export function applySongMetadata(
	meta: WorkspaceMeta,
	song: SongMetadata,
	{ overwrite = false } = {},
): WorkspaceMeta {
	const pick = (current: string | undefined, next: string) =>
		(overwrite || !current) && next ? next : (current ?? "");
	const songwriters =
		(overwrite || !meta.songwriters?.length) && song.songwriters.length > 0
			? song.songwriters
			: meta.songwriters;

	return {
		...meta,
		title: pick(meta.title, song.title),
		artists: pick(meta.artists, song.artists.join(", ")),
		album: pick(meta.album, song.album),
		songwriters,
		extraAmllMeta: { ...meta.extraAmllMeta, ...song.amllMeta },
	};
}
