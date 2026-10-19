import { describe, expect, it } from "bun:test";
import { parseTimestampToMs, validateTtml } from "../src/ttml/validate";
import { sampleCompleted, ttml } from "./helpers";

const AGENT_V1 =
	'<ttm:agent type="group" xml:id="v1"><ttm:name type="full">Singer</ttm:name></ttm:agent>';
const TRACK_B = (text: string) =>
	`<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><translations><translation xml:lang="zh-Hans"><text for="L1">${text}</text></translation></translations></iTunesMetadata>`;

function singleLine({
	agents = AGENT_V1,
	div = 'begin="0:10.000" end="0:15.000"',
	p = 'begin="0:10.000" end="0:15.000"',
	content = '<span begin="0:10.000" end="0:15.000">꽃을 피워</span><span ttm:role="x-translation" xml:lang="zh-Hans">花开</span>',
} = {}) {
	return ttml(
		agents + TRACK_B("花开"),
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
