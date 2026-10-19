#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
	applySongMetadata,
	METADATA_SOURCES,
	mergeSongMetadata,
	PROVIDERS,
	parseSongUrl,
} from "../src/metadata";
import type {
	MetadataSource,
	SongCandidate,
	SongMetadata,
	WorkspaceData,
} from "../src/types";
import { CliError, readTextFile, runCli } from "./shared";

const USAGE = `Usage: bun scripts/fetch_song_meta.ts <"artist title" | song url> [options]

Options:
  --source <qq|netease|all>   Platforms to query (default: all, QQ Music takes priority)
  --select <n>                Candidate index per platform (default: 1)
  --apply <workspace.json>    Fill missing title, artists, album, songwriters and platform ids
  --force                     With --apply, overwrite existing values
  --json                      Output merged metadata as JSON`;

const CANDIDATES_SHOWN = 5;

function describe(c: SongCandidate): string {
	const date = c.releaseDate ? ` (${c.releaseDate})` : "";
	return `${c.title} - ${c.artists.join(", ")} | ${c.album || "?"}${date}`;
}

async function searchAndFetch(
	source: MetadataSource,
	query: string,
	select: number,
): Promise<SongMetadata> {
	const provider = PROVIDERS[source];
	const hits = await provider.search(query);
	const chosen = hits[Math.min(select, hits.length) - 1];
	if (!chosen) throw new Error(`no results for "${query}"`);

	console.error(`[${source}] ${provider.name} candidates:`);
	hits.slice(0, CANDIDATES_SHOWN).forEach((c, i) => {
		console.error(`  ${c === chosen ? "*" : " "} ${i + 1}. ${describe(c)}`);
	});
	return provider.fetch(chosen.id);
}

/** Queries each source in priority order, skipping platforms that fail */
async function collect(
	query: string,
	sources: MetadataSource[],
	select: number,
): Promise<SongMetadata[]> {
	const ref = parseSongUrl(query);
	if (ref) return [await PROVIDERS[ref.source].fetch(ref.id)];

	const songs: SongMetadata[] = [];
	for (const source of sources) {
		try {
			songs.push(await searchAndFetch(source, query, select));
		} catch (err) {
			console.error(
				`[${source}] skipped: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
	return songs;
}

function printSong(song: SongMetadata): void {
	const rows: [string, string][] = [
		["Title", song.title],
		["Artists", song.artists.join(", ")],
		["Album", song.album],
		["Release", song.releaseDate],
		["Songwriters", song.songwriters.join(", ")],
		...Object.entries(song.credits).map(
			([label, names]) => [`  ${label}`, names.join(", ")] as [string, string],
		),
		...Object.entries(song.amllMeta),
	];
	for (const [label, value] of rows) {
		if (value) console.log(`${label.padEnd(14)} ${value}`);
	}
}

runCli(async () => {
	const { positionals, values } = parseArgs({
		args: process.argv.slice(2),
		allowPositionals: true,
		options: {
			source: { type: "string", default: "all" },
			select: { type: "string", default: "1" },
			apply: { type: "string" },
			force: { type: "boolean", default: false },
			json: { type: "boolean", default: false },
		},
	});
	const query = positionals.join(" ").trim();
	if (!query) {
		console.log(USAGE);
		return 1;
	}

	const sources =
		values.source === "all"
			? METADATA_SOURCES
			: METADATA_SOURCES.filter((s) => s === values.source);
	if (sources.length === 0)
		throw new CliError(`Unknown source: ${values.source}`);

	const select = Math.max(1, Number.parseInt(values.select, 10) || 1);
	const songs = await collect(query, sources, select);
	if (songs.length === 0) throw new CliError("No platform returned metadata");
	const song = mergeSongMetadata(songs);

	if (values.json) console.log(JSON.stringify(song, null, 2));
	else printSong(song);

	if (values.apply) {
		const workspace = JSON.parse(
			readTextFile(values.apply, "Workspace JSON"),
		) as WorkspaceData;
		workspace.meta = applySongMetadata(workspace.meta, song, {
			overwrite: values.force,
		});
		writeFileSync(
			values.apply,
			`${JSON.stringify(workspace, null, 2)}\n`,
			"utf-8",
		);
		console.error(`[APPLY] Updated metadata in ${values.apply}`);
	}
	return 0;
});
