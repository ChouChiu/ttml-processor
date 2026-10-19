import { describe, expect, it } from "bun:test";
import { pickCandidate } from "../src/genius/client";
import {
	mapToItunesPart,
	parseHeaderBracket,
	parseLyricsHtml,
} from "../src/genius/parser";
import { generateTtmlSkeleton } from "../src/genius/skeleton";
import type { GeniusHit } from "../src/types";

describe("parseHeaderBracket", () => {
	it("maps song parts, extracts vocalists, and ignores non-lyric headers", () => {
		// Part mapping priority
		expect(mapToItunesPart("Pre-Chorus")).toBe("Pre-Chorus");
		expect(mapToItunesPart("Post Chorus")).toBe("Post-Chorus");
		expect(mapToItunesPart("Hook")).toBe("Chorus");
		expect(mapToItunesPart("Something else")).toBe("Verse");

		// Header with singers
		expect(parseHeaderBracket("Chorus: Karina, Winter & Ningning")).toEqual({
			label: "Chorus",
			part: "Chorus",
			singers: ["Karina", "Winter", "Ningning"],
		});
		expect(parseHeaderBracket("Bridge: Everyone")?.singers).toEqual(["All"]);

		// Singer switch without new section
		expect(parseHeaderBracket("Karina")).toEqual({
			label: "Karina",
			part: null,
			singers: ["Karina"],
		});
		expect(parseHeaderBracket("All")?.singers).toEqual(["All"]);

		// Non-lyric headers
		expect(parseHeaderBracket("Supernova Lyrics")).toBeNull();
	});
});

describe("parseLyricsHtml", () => {
	it("attributes lines to the active singer within each section", () => {
		const html = `<h1>Supernova</h1><div data-lyrics-container="true">
			<div data-exclude-from-selection="true">[Supernova Lyrics]</div>
			[Verse 1: Karina]<br>Line one<br>[Winter]<br>Line two<br>
			[Chorus: All]<br>Su su supernova</div>`;
		const data = parseLyricsHtml(html, "https://genius.com/x");
		expect(data.unique_singers).toEqual(["Karina", "Winter"]);
		expect(data.unique_parts).toEqual(["Chorus", "Verse"]);
		expect(
			data.sections.map((s) => [s.itunes_part, s.lines.map((l) => l.singers)]),
		).toEqual([
			["Verse", [["Karina"], ["Winter"]]],
			["Chorus", [["All"]]],
		]);
	});
});

describe("pickCandidate", () => {
	const hit = (full_title: string): GeniusHit => ({
		title: full_title,
		full_title,
		artist: "aespa",
		url: `https://genius.com/${full_title}`,
	});
	const hits = [
		hit("Supernova (Romanized)"),
		hit("Supernova"),
		hit("Supernova (English Translation)"),
	];

	it("skips derivative pages unless the query asks for them", () => {
		expect(pickCandidate(hits, "aespa supernova")?.full_title).toBe(
			"Supernova",
		);
		expect(pickCandidate(hits, "supernova romanized")?.full_title).toBe(
			"Supernova (Romanized)",
		);
	});
});

describe("generateTtmlSkeleton", () => {
	it("declares group agents, compound agents and the ensemble", () => {
		const skeleton = generateTtmlSkeleton({
			title: "Supernova",
			url: "",
			unique_singers: ["Karina", "Winter"],
			unique_parts: ["Verse", "Chorus"],
			sections: [
				{
					raw_header: "Verse 1",
					itunes_part: "Verse",
					singers: ["Karina", "Winter"],
					lines: [],
				},
				{
					raw_header: "Chorus",
					itunes_part: "Chorus",
					singers: ["All"],
					lines: [],
				},
			],
		});
		expect(skeleton).toContain(
			'<ttm:agent type="group" xml:id="v1 v2"><ttm:name type="full">Karina, Winter</ttm:name></ttm:agent>',
		);
		expect(skeleton).toContain('xml:id="v1000"');
		expect(skeleton).toContain('itunes:key="L..." ttm:agent="v1 v2"');
		expect(skeleton).toContain('itunes:key="L..." ttm:agent="v1000"');
	});
});
