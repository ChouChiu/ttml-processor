import * as cheerio from "cheerio";
import type { ParsedLyricsData, ParsedSection, SectionHeader } from "../types";

/** Singer label Genius uses for the whole group */
export const ENSEMBLE = "All";

const ENSEMBLE_KEYWORDS = new Set([
	"all",
	"everyone",
	"chorus",
	"together",
	"unison",
]);

/** Ordered so that more specific names (Pre-Chorus) win over generic ones (Chorus) */
const PART_RULES: [RegExp, string][] = [
	[/intro/, "Intro"],
	[/pre[- ]?chorus/, "Pre-Chorus"],
	[/post[- ]?chorus/, "Post-Chorus"],
	[/chorus|hook|drop/, "Chorus"],
	[/bridge/, "Bridge"],
	[/outro/, "Outro"],
	[/refrain/, "Refrain"],
	[/verse/, "Verse"],
];

const NON_LYRIC_HEADER = /lyrics|가사|traduction/i;

function matchItunesPart(name: string): string | null {
	const lower = name.toLowerCase();
	return PART_RULES.find(([re]) => re.test(lower))?.[1] ?? null;
}

export function mapToItunesPart(name: string): string {
	return matchItunesPart(name) ?? "Verse";
}

const cleanSingerToken = (raw: string) =>
	raw.replace(/[*_"'()[\]]/g, "").trim();
const isEnsemble = (name: string) => ENSEMBLE_KEYWORDS.has(name.toLowerCase());

function parseSingers(raw: string): string[] {
	if (isEnsemble(cleanSingerToken(raw))) return [ENSEMBLE];
	return raw
		.split(/[,&/]|\band\b|\bwith\b|\bfeat\.?\b/)
		.map(cleanSingerToken)
		.filter((s) => s && !isEnsemble(s));
}

/** Parses the text inside a Genius "[...]" header such as "Chorus: Karina, Winter" */
export function parseHeaderBracket(content: string): SectionHeader | null {
	const header = content.trim();
	if (NON_LYRIC_HEADER.test(header)) return null;

	const colon = header.indexOf(":");
	const label = colon === -1 ? header : header.slice(0, colon).trim();
	const singers = colon === -1 ? "" : header.slice(colon + 1).trim();
	const part = matchItunesPart(label);

	// "[Karina]" switches the singer without starting a new section
	if (!part && !singers)
		return { label, part: null, singers: parseSingers(label) };
	return { label, part: part ?? "Verse", singers: parseSingers(singers) };
}

function extractLyricLines(html: string): { title: string; lines: string[] } {
	const $ = cheerio.load(html);
	$("[data-exclude-from-selection='true']").remove();

	let containers = $("div[data-lyrics-container='true']");
	if (containers.length === 0)
		containers = $("div[class*='Lyrics__Container']");

	const blocks = containers.toArray().map((el) => {
		$(el).find("br").replaceWith("\n");
		return $(el).text();
	});
	return {
		title: $("h1").first().text().trim() || "Unknown Title",
		lines: blocks
			.join("\n")
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean),
	};
}

/** Splits a Genius lyrics page into song parts with per-line singer attribution */
export function parseLyricsHtml(html: string, url: string): ParsedLyricsData {
	const { title, lines } = extractLyricLines(html);
	const sections: ParsedSection[] = [];
	const singers = new Set<string>();
	const parts = new Set<string>();

	let section: ParsedSection = {
		raw_header: "Intro",
		itunes_part: "Intro",
		singers: [],
		lines: [],
	};
	let voice = section.singers;

	for (const line of lines) {
		const bracket = /^\[(.*)\]$/.exec(line);
		if (!bracket) {
			section.lines.push({ text: line, singers: voice });
			continue;
		}

		const header = parseHeaderBracket(bracket[1] ?? "");
		if (!header) continue;
		for (const s of header.singers) if (s !== ENSEMBLE) singers.add(s);

		if (header.part === null) {
			if (header.singers.length > 0) voice = header.singers;
			continue;
		}

		if (section.lines.length > 0) sections.push(section);
		section = {
			raw_header: header.label,
			itunes_part: header.part,
			singers: header.singers,
			lines: [],
		};
		voice = header.singers;
		parts.add(header.part);
	}
	if (section.lines.length > 0) sections.push(section);

	return {
		title,
		url,
		unique_singers: [...singers].sort(),
		unique_parts: [...parts].sort(),
		sections,
	};
}
