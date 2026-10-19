import { describe, expect, it } from "bun:test";
import { parseTimestampToMs, validateTtml } from "../src/ttml/validate";
import { sampleCompleted, ttml } from "./helpers";

const META_BASE = `
<ttm:title>Sample Song</ttm:title>
<amll:meta key="musicName" value="Sample Song"/>
<amll:meta key="artists" value="Singer"/>
`;
const AGENT_V1 =
	'<ttm:agent type="group" xml:id="v1"><ttm:name type="full">Singer</ttm:name></ttm:agent>';
const TRACK_B = (text: string) =>
	`<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters><songwriter>Writer</songwriter></songwriters><translations><translation xml:lang="zh-Hans"><text for="L1">${text}</text></translation></translations></iTunesMetadata>`;

function singleLine({
	meta = META_BASE,
	agents = AGENT_V1,
	div = 'begin="0:10.000" end="0:15.000"',
	p = 'begin="0:10.000" end="0:15.000"',
	content = '<span begin="0:10.000" end="0:15.000">꽃을 피워</span><span ttm:role="x-translation" xml:lang="zh-Hans">花开</span>',
	itunes = TRACK_B("花开"),
} = {}) {
	return ttml(
		meta + agents + itunes,
		`<div itunes:songPart="Verse" ${div}><p ${p} itunes:key="L1" ttm:agent="v1">${content}</p></div>`,
	);
}

describe("parseTimestampToMs", () => {
	it("parses seconds, MM:SS and HH:MM:SS forms", () => {
		expect(parseTimestampToMs("10.5s")).toBe(10500);
		expect(parseTimestampToMs("01:30.500")).toBe(90500);
		expect(parseTimestampToMs("1:00:30.000")).toBe(3630000);
		expect(parseTimestampToMs("abc")).toBeNull();
	});
});

describe("validateTtml", () => {
	it("passes the completed example without warnings", () => {
		const res = validateTtml(sampleCompleted());
		expect(res.errors).toEqual([]);
		expect(res.warnings).toEqual([]);
		expect(res.valid).toBe(true);
	});

	it("passes a minimal compliant file without warnings", () => {
		const res = validateTtml(singleLine());
		expect(res.valid).toBe(true);
		expect(res.warnings).toEqual([]);
	});

	it("warns when title or essential AMLL metadata is missing", () => {
		const res = validateTtml(singleLine({ meta: "" }));
		expect(
			res.warnings.some((w) => w.includes("Missing or empty <ttm:title>")),
		).toBe(true);
		expect(res.warnings.some((w) => w.includes("musicName"))).toBe(true);
		expect(res.warnings.some((w) => w.includes("artists"))).toBe(true);
	});

	it("warns when songwriters block is missing or empty", () => {
		const missingRes = validateTtml(
			singleLine({
				itunes:
					'<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><translations><translation xml:lang="zh-Hans"><text for="L1">花开</text></translation></translations></iTunesMetadata>',
			}),
		);
		expect(
			missingRes.warnings.some((w) =>
				w.includes("Missing <songwriters> block"),
			),
		).toBe(true);

		const emptyRes = validateTtml(
			singleLine({
				itunes:
					'<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters></songwriters><translations><translation xml:lang="zh-Hans"><text for="L1">花开</text></translation></translations></iTunesMetadata>',
			}),
		);
		expect(
			emptyRes.warnings.some((w) => w.includes("Empty <songwriters> block")),
		).toBe(true);
	});

	it("warns on duplicate songwriters", () => {
		const res = validateTtml(
			singleLine({
				itunes:
					'<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters><songwriter>KENZIE</songwriter><songwriter>kenzie</songwriter></songwriters><translations><translation xml:lang="zh-Hans"><text for="L1">花开</text></translation></translations></iTunesMetadata>',
			}),
		);
		expect(
			res.warnings.some((w) => w.includes("Duplicate songwriter 'kenzie'")),
		).toBe(true);
	});

	it("warns on duplicate agent declarations", () => {
		const duplicateAgents =
			AGENT_V1 +
			'\n<ttm:agent type="group" xml:id="v1"><ttm:name type="full">Singer Clone</ttm:name></ttm:agent>';
		const res = validateTtml(singleLine({ agents: duplicateAgents }));
		expect(
			res.warnings.some((w) =>
				w.includes("Duplicate agent declaration with xml:id='v1'"),
			),
		).toBe(true);
	});

	it("warns on duplicate line keys", () => {
		const body = `
<div itunes:songPart="Verse" begin="0:10.000" end="0:20.000">
  <p begin="0:10.000" end="0:15.000" itunes:key="L1" ttm:agent="v1"><span begin="0:10.000" end="0:15.000">One</span><span ttm:role="x-translation" xml:lang="zh-Hans">一</span></p>
  <p begin="0:15.000" end="0:20.000" itunes:key="L1" ttm:agent="v1"><span begin="0:15.000" end="0:20.000">Two</span><span ttm:role="x-translation" xml:lang="zh-Hans">二</span></p>
</div>`;
		const res = validateTtml(ttml(META_BASE + AGENT_V1 + TRACK_B("一"), body));
		expect(
			res.warnings.some((w) => w.includes("Duplicate line key 'L1'")),
		).toBe(true);
	});

	it("warns on duplicate AMLL metadata keys", () => {
		const duplicateAmll = `${META_BASE}\n<amll:meta key="musicName" value="Another Title"/>`;
		const res = validateTtml(singleLine({ meta: duplicateAmll }));
		expect(
			res.warnings.some((w) =>
				w.includes("Duplicate <amll:meta> entry for key='musicName'"),
			),
		).toBe(true);
	});

	it("warns on duplicate centralized translations and transliterations", () => {
		const itunesWithDupes = `
<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
  <songwriters><songwriter>Writer</songwriter></songwriters>
  <translations>
    <translation xml:lang="zh-Hans">
      <text for="L1">花开</text>
      <text for="L1">重复花开</text>
    </translation>
  </translations>
  <transliterations>
    <transliteration xml:lang="ko-Latn">
      <text for="L1">kkocheul</text>
      <text for="L1">kkocheul dupe</text>
    </transliteration>
  </transliterations>
</iTunesMetadata>`;
		const res = validateTtml(singleLine({ itunes: itunesWithDupes }));
		expect(
			res.warnings.some((w) =>
				w.includes("Duplicate centralized translation entry for line 'L1'"),
			),
		).toBe(true);
		expect(
			res.warnings.some((w) =>
				w.includes("Duplicate centralized transliteration entry for line 'L1'"),
			),
		).toBe(true);
	});

	it("warns when an agent is declared as type=person", () => {
		const res = validateTtml(
			singleLine({ agents: AGENT_V1.replace("group", "person") }),
		);
		expect(res.warnings.some((w) => w.includes("type='person'"))).toBe(true);
	});

	it("warns on reversed timestamps", () => {
		const res = validateTtml(
			singleLine({
				div: 'begin="0:15.000" end="0:05.000"',
				p: 'begin="0:15.000" end="0:05.000"',
			}),
		);
		expect(
			res.warnings.filter((w) => w.includes("timestamp error")),
		).toHaveLength(2);
	});

	it("fails on undeclared agents", () => {
		const res = validateTtml(singleLine({ agents: "" }));
		expect(res.valid).toBe(false);
		expect(res.errors[0]).toContain("undeclared agent 'v1'");
	});

	it("flags Latin words copied into the transliteration", () => {
		const res = validateTtml(
			singleLine({
				content:
					'<span begin="0:10.000" end="0:15.000">꽃을 catwalking</span><span ttm:role="x-translation" xml:lang="zh-Hans">花开</span><span ttm:role="x-roman" xml:lang="ko-Latn">kkocheul catwalking</span>',
			}),
		);
		expect(res.warnings.some((w) => w.includes("[catwalking]"))).toBe(true);
	});

	it("judges Option C on lead vocals only, ignoring background annotations", () => {
		const res = validateTtml(
			singleLine({
				content:
					'<span begin="0:10.000" end="0:15.000">Hello</span><span ttm:role="x-bg"><span>(꽃)</span><span ttm:role="x-translation">花</span></span><span ttm:role="x-translation" xml:lang="zh-Hans">花开</span><span ttm:role="x-roman" xml:lang="ko-Latn">hello</span>',
			}),
		);
		expect(res.warnings.some((w) => w.includes("pure Latin line"))).toBe(true);
	});
});
