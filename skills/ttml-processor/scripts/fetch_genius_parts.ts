#!/usr/bin/env bun
import { parseArgs } from "node:util";
import {
	pickCandidate,
	scrapeGeniusLyrics,
	searchGenius,
} from "../src/genius/client";
import { generateTtmlSkeleton } from "../src/genius/skeleton";
import type { ParsedLyricsData } from "../src/types";
import { CliError, runCli } from "./shared";

const USAGE = `Usage: bun scripts/fetch_genius_parts.ts <song query or genius url> [options]

Options:
  --select <n>     Select candidate index (default: 1)
  --ttml           Output copy-paste ready TTML <ttm:agent> and <div> code
  --lyrics, -l     Print full line-by-line lyrics with vocalists
  --json           Output raw parsed JSON`;

const RULE = "=".repeat(60);

async function resolveUrl(query: string, select: number): Promise<string> {
	if (/^https?:\/\//.test(query)) return query;

	console.error(`[SEARCH] Querying Genius for: "${query}" ...`);
	const chosen = pickCandidate(await searchGenius(query), query, select);
	if (!chosen) throw new CliError(`No results found on Genius for "${query}"`);
	console.error(`[TARGET] Selected: ${chosen.full_title} (${chosen.url})\n`);
	return chosen.url;
}

function printOverview(data: ParsedLyricsData): void {
	const vocalists = data.unique_singers.join(", ") || "None explicitly tagged";
	console.log(RULE);
	console.log(`Title: ${data.title}`);
	console.log(`URL: ${data.url}`);
	console.log(`Vocalists (${data.unique_singers.length}): ${vocalists}`);
	console.log(`Song Parts: ${data.unique_parts.join(", ")}`);
	console.log(`Total Sections: ${data.sections.length}`);
	console.log(RULE);

	console.log("\n[Section & Vocalist Overview]");
	data.sections.forEach((sec, i) => {
		const num = String(i + 1).padStart(2, "0");
		const singers =
			sec.singers.length > 0 ? ` | Vocalists: ${sec.singers.join(", ")}` : "";
		console.log(
			`  [${num}] ${sec.raw_header.padEnd(24)} (itunes:songPart="${sec.itunes_part}")${singers} [${sec.lines.length} lines]`,
		);
	});
}

function printLyrics(data: ParsedLyricsData): void {
	console.log(`\n${RULE}\n[Line-by-Line Breakdown with Vocalists]\n${RULE}`);
	for (const sec of data.sections) {
		const singers =
			sec.singers.length > 0 ? ` - (${sec.singers.join(", ")})` : "";
		console.log(
			`\n--- [${sec.raw_header} -> itunes:songPart="${sec.itunes_part}"]${singers} ---`,
		);
		for (const line of sec.lines) {
			const tag =
				line.singers.length > 0 ? `[${line.singers.join(", ")}] ` : "";
			console.log(`  ${tag}${line.text}`);
		}
	}
}

runCli(async () => {
	const { positionals, values } = parseArgs({
		args: process.argv.slice(2),
		allowPositionals: true,
		options: {
			select: { type: "string", default: "1" },
			ttml: { type: "boolean", default: false },
			lyrics: { type: "boolean", short: "l", default: false },
			json: { type: "boolean", default: false },
		},
	});
	const query = positionals.join(" ").trim();
	if (!query) {
		console.log(USAGE);
		return 1;
	}

	const select = Number.parseInt(values.select, 10) || 1;
	const data = await scrapeGeniusLyrics(await resolveUrl(query, select));

	if (values.json) {
		console.log(JSON.stringify(data, null, 2));
	} else if (values.ttml) {
		console.log(generateTtmlSkeleton(data));
	} else {
		printOverview(data);
		if (values.lyrics) printLyrics(data);
		console.log(
			"\n[TIP] Use `--ttml` to generate copy-paste ready TTML <ttm:agent> declarations and <div> skeletons",
		);
	}
	return 0;
});
