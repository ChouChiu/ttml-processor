import { describe, expect, it } from "bun:test";
import {
	applySongMetadata,
	mergeSongMetadata,
	parseLyricCredits,
	parseSongUrl,
	songwritersFrom,
} from "../src/metadata";
import type { SongMetadata } from "../src/types";
import { sampleWorkspace } from "./helpers";

const song = (overrides: Partial<SongMetadata>): SongMetadata => ({
	source: "qq",
	id: "000JBYAP1N4s5M",
	title: "Supernova",
	artists: ["aespa"],
	album: "Supernova",
	releaseDate: "2024-05-13",
	durationMs: 178000,
	url: "",
	credits: {},
	songwriters: [],
	amllMeta: { qqMusicId: "000JBYAP1N4s5M" },
	...overrides,
});

describe("parseLyricCredits", () => {
	it("reads QQ and NetEase header styles into canonical roles", () => {
		const qq =
			"[ti:Supernova]\n[ar:aespa]\n[00:00.17]Supernova - aespa\n[00:00.66]词：KENZIE\n[00:00.81]曲：KENZIE/Paris Alexa\n[00:03.15]I'm like some kind of Supernova";
		const netease =
			"[00:00.00] 作词 : KENZIE\n[00:01.00] 作曲 : KENZIE/Dem Jointz\n[00:02.00] Producer : Dem Jointz";
		expect(parseLyricCredits(qq)).toEqual({
			作词: ["KENZIE"],
			作曲: ["KENZIE", "Paris Alexa"],
		});
		expect(parseLyricCredits(netease)).toEqual({
			作词: ["KENZIE"],
			作曲: ["KENZIE", "Dem Jointz"],
			制作人: ["Dem Jointz"],
		});
	});

	it("does not mistake lyric lines with colons for credits", () => {
		expect(
			parseLyricCredits("[00:10.00]Baby: hold on\n[00:12.00]Time: 3am"),
		).toEqual({});
	});

	it("accumulates multiple credit lines for the same role without duplicates", () => {
		const lrc =
			"[00:00.00] 作词 : Writer A\n[00:01.00] 作词 : Writer B / Writer A\n[00:02.00] 作曲 : Composer C";
		expect(parseLyricCredits(lrc)).toEqual({
			作词: ["Writer A", "Writer B"],
			作曲: ["Composer C"],
		});
	});

	it("dedupes songwriters case-insensitively and trims whitespace", () => {
		expect(
			songwritersFrom({
				作词: [" KENZIE ", ""],
				作曲: ["kenzie", "  Dem Jointz  "],
				编曲: ["X"],
			}),
		).toEqual(["KENZIE", "Dem Jointz"]);
	});
});

describe("parseSongUrl", () => {
	it("recognizes NetEase and QQ Music song pages", () => {
		expect(parseSongUrl("https://music.163.com/#/song?id=2160418335")).toEqual({
			source: "netease",
			id: "2160418335",
		});
		expect(
			parseSongUrl("https://y.qq.com/n/ryqq/songDetail/000JBYAP1N4s5M"),
		).toEqual({
			source: "qq",
			id: "000JBYAP1N4s5M",
		});
		expect(parseSongUrl("aespa supernova")).toBeNull();
	});
});

describe("mergeSongMetadata", () => {
	it("prefers the first platform and only fills gaps from later ones", () => {
		const merged = mergeSongMetadata([
			song({ album: "", credits: { 作词: ["KENZIE"] } }),
			song({
				source: "netease",
				album: "Armageddon",
				credits: { 作词: ["Someone"], 编曲: ["Dem Jointz"] },
				amllMeta: { ncmMusicId: "2155478102" },
			}),
		]);
		expect(merged.album).toBe("Armageddon");
		expect(merged.credits).toEqual({ 作词: ["KENZIE"], 编曲: ["Dem Jointz"] });
		expect(merged.songwriters).toEqual(["KENZIE"]);
		expect(merged.amllMeta).toEqual({
			qqMusicId: "000JBYAP1N4s5M",
			ncmMusicId: "2155478102",
		});
	});
});

describe("applySongMetadata", () => {
	const fetched = song({ album: "Supernova", songwriters: ["KENZIE"] });

	it("keeps existing values but always adds platform ids", () => {
		const { meta } = sampleWorkspace();
		const applied = applySongMetadata(meta, fetched);
		expect(applied.album).toBe(meta.album);
		expect(applied.songwriters).toEqual(meta.songwriters);
		expect(applied.extraAmllMeta).toEqual({ qqMusicId: "000JBYAP1N4s5M" });
	});

	it("fills empty fields and overwrites when forced", () => {
		const { meta } = sampleWorkspace();
		expect(applySongMetadata({ ...meta, album: "" }, fetched).album).toBe(
			"Supernova",
		);
		expect(
			applySongMetadata(meta, fetched, { overwrite: true }).songwriters,
		).toEqual(["KENZIE"]);
	});

	it("deduplicates and trims dirty songwriters during apply", () => {
		const { meta } = sampleWorkspace();
		const dirtyMeta = {
			...meta,
			songwriters: [" KENZIE ", "kenzie", "  ", "Dem Jointz"],
		};
		const applied = applySongMetadata(dirtyMeta, fetched);
		expect(applied.songwriters).toEqual(["KENZIE", "Dem Jointz"]);
	});
});
