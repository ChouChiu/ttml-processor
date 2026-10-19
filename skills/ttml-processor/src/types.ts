export interface WorkspaceMeta {
	title: string;
	artists: string;
	album: string;
	author: string;
	translationLang?: string;
	romanLang?: string;
	songwriters?: string[];
	extraAmllMeta?: Record<string, string>;
	agents: Record<string, string>;
}

export interface WorkspaceLine {
	key: string;
	part: string;
	agent: string;
	text: string;
	translation: string;
	bg_text?: string;
	bg_translation?: string;
}

export interface WorkspaceData {
	meta: WorkspaceMeta;
	lines: WorkspaceLine[];
}

export interface BuildOptions {
	/** Generate Option C transliterations (default true) */
	romanize?: boolean;
	/** Segment multi-character non-Latin words into syllables with 1:1 timed transliterations (default false) */
	segment?: boolean;
}

export interface SyllableSpan {
	begin: string;
	end: string;
	text: string;
}

export interface ValidationResult {
	/** False when any blocking error was found */
	valid: boolean;
	errors: string[];
	warnings: string[];
	info: string[];
}

export interface GeniusHit {
	title: string;
	full_title: string;
	artist: string;
	url: string;
}

export interface ParsedLine {
	text: string;
	singers: string[];
}

export interface SectionHeader {
	label: string;
	/** itunes:songPart value, or null when the bracket only switches singers */
	part: string | null;
	singers: string[];
}

export interface ParsedSection {
	raw_header: string;
	itunes_part: string;
	singers: string[];
	lines: ParsedLine[];
}

export interface ParsedLyricsData {
	title: string;
	url: string;
	unique_singers: string[];
	unique_parts: string[];
	sections: ParsedSection[];
}

export type MetadataSource = "qq" | "netease";

/** A search result from a music platform */
export interface SongCandidate {
	source: MetadataSource;
	/** NetEase numeric id or QQ song mid */
	id: string;
	title: string;
	artists: string[];
	album: string;
	releaseDate: string;
	durationMs: number;
}

export interface SongMetadata extends SongCandidate {
	url: string;
	/** Credit lines from the lyric header, keyed by their original label (作词, 作曲, ...) */
	credits: Record<string, string[]>;
	/** Lyricists and composers, deduplicated */
	songwriters: string[];
	/** Platform ids as AMLL meta keys, e.g. ncmMusicId or qqMusicId */
	amllMeta: Record<string, string>;
}
