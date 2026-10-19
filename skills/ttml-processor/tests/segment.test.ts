import { describe, expect, it } from "bun:test";
import { TTMLParser, toAmllLyrics } from "@applemusic-like-lyrics/ttml";
import { DOMParser } from "@xmldom/xmldom";
import { buildTtml } from "../src/ttml/build";
import {
	assignTrailingSpaces,
	formatTimestamp,
	type SyllableSpan,
	segmentSpan,
} from "../src/ttml/segment";
import type { WorkspaceData } from "../src/types";
import { ttml } from "./helpers";

describe("segment", () => {
	it("formatTimestamp supports clock and seconds formats", () => {
		expect(formatTimestamp(12345, "0:00.000")).toBe("0:12.345");
		expect(formatTimestamp(65432, "0:00.000")).toBe("1:05.432");
		expect(formatTimestamp(12345, "12.345")).toBe("12.345");
	});

	it("segments multi-character Korean word into single-character spans with proportional timestamps", () => {
		const bodySpan: SyllableSpan = {
			begin: "0:10.000",
			end: "0:14.000",
			text: "완벽해진",
		};
		const transSpan: SyllableSpan = {
			begin: "0:10.000",
			end: "0:14.000",
			text: "wan byeok hae jin",
		};

		const res = segmentSpan(bodySpan, transSpan, "ko-Latn");
		expect(res.body).toEqual([
			{ begin: "0:10.000", end: "0:11.000", text: "완" },
			{ begin: "0:11.000", end: "0:12.000", text: "벽" },
			{ begin: "0:12.000", end: "0:13.000", text: "해" },
			{ begin: "0:13.000", end: "0:14.000", text: "진" },
		]);
		expect(res.trans).toEqual([
			{ begin: "0:10.000", end: "0:11.000", text: "wan" },
			{ begin: "0:11.000", end: "0:12.000", text: "byeok" },
			{ begin: "0:12.000", end: "0:13.000", text: "hae" },
			{ begin: "0:13.000", end: "0:14.000", text: "jin" },
		]);
	});

	it("assigns trailing spaces only to word boundary tokens", () => {
		const spans: SyllableSpan[] = [
			{ begin: "0:01.000", end: "0:02.000", text: "더" },
			{ begin: "0:02.000", end: "0:03.000", text: "완" },
			{ begin: "0:03.000", end: "0:04.000", text: "벽" },
			{ begin: "0:04.000", end: "0:05.000", text: "해" },
			{ begin: "0:05.000", end: "0:06.000", text: "진" },
			{ begin: "0:06.000", end: "0:07.000", text: "우리" },
		];
		assignTrailingSpaces(spans, "더 완벽해진 우리");

		expect(spans.map((s) => s.text)).toEqual([
			"더 ",
			"완",
			"벽",
			"해",
			"진 ",
			"우리",
		]);
		expect(spans.map((s) => s.text).join("")).toBe("더 완벽해진 우리");
	});

	it("builds segmented TTML with timed transliterations and AMLL syllable compatibility", async () => {
		const raw = ttml(
			`<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
        <transliterations>
          <transliteration xml:lang="ko-Latn">
            <text for="L1">
              <span begin="0:10.000" end="0:11.000">deo</span>
              <span begin="0:11.000" end="0:13.000">wan byeok</span>
            </text>
          </transliteration>
        </transliterations>
      </iTunesMetadata>`,
			`<p begin="0:10.000" end="0:13.000" itunes:key="L1" ttm:agent="v1">
        <span begin="0:10.000" end="0:11.000">더</span>
        <span begin="0:11.000" end="0:13.000">완벽</span>
      </p>`,
		);

		const ws: WorkspaceData = {
			meta: {
				title: "Test Song",
				artists: "Test Artist",
				album: "Test Album",
				author: "ChouChiu",
				romanLang: "ko-Latn",
				agents: { v1: "Singer" },
			},
			lines: [
				{
					key: "L1",
					part: "Verse",
					agent: "v1",
					text: "더 완벽",
					translation: "更加完美",
				},
			],
		};

		const built = await buildTtml(raw, ws, { segment: true });

		// Verify TTML structure
		expect(built).toContain('<span begin="0:11.000" end="0:12.000">완</span>');
		expect(built).toContain('<span begin="0:12.000" end="0:13.000">벽</span>');
		expect(built).toContain(
			'<span ttm:role="x-translation" xml:lang="zh-Hans">更加完美</span>',
		);
		// Avoid static x-roman when timed transliteration spans are present
		expect(built).not.toContain('ttm:role="x-roman"');

		// Parse with official AMLL parser
		const doc = TTMLParser.parse(built, { domParser: new DOMParser() });
		const amll = toAmllLyrics(doc);

		expect(amll.lines.length).toBe(1);
		const line = amll.lines[0];
		expect(line).toBeDefined();
		if (!line) throw new Error("Line is undefined");
		expect(line.translatedLyric).toBe("更加完美");
		expect(line.romanLyric).toBe(""); // No static 3rd line clutter
		expect(line.isDuet).toBe(false);

		// Syllable roman words are populated!
		expect(line.words?.map((w) => w.word)).toEqual(["더 ", "완", "벽"]);
		expect(line.words?.map((w) => w.romanWord)).toEqual([
			"deo",
			"wan",
			"byeok",
		]);
	});
});
