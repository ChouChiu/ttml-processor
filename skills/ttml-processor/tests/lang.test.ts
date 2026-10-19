import { describe, expect, it } from "bun:test";
import { detectSongLanguage, getTtmlLangTag } from "../src/lang";
import { romanizeOptionC } from "../src/romanizer";

describe("detectSongLanguage", () => {
	it("picks the dominant script and treats Han without Kana as Chinese", () => {
		expect(
			detectSongLanguage(["꽃을 피워", "Watch how I let it all unfold"]),
		).toBe("ko");
		expect(detectSongLanguage(["未来へ 歩き出す", "世界は Beautiful"])).toBe(
			"ja",
		);
		expect(detectSongLanguage(["我们一起走向未来", "Forever"])).toBe("zh");
		expect(detectSongLanguage(["I know my worth"])).toBe("latin");
	});
});

describe("getTtmlLangTag", () => {
	it("maps languages to transliteration tags", () => {
		expect(getTtmlLangTag("zh-Hans")).toBe("zh-Latn");
		expect(getTtmlLangTag("latin")).toBe("und-Latn");
	});
});

describe("romanizeOptionC", () => {
	it("returns null for pure Latin lines", async () => {
		expect(await romanizeOptionC("Uh, yeah, 1, 2, 3, go!")).toBeNull();
		expect(await romanizeOptionC("Don't stop the music", "ko-Latn")).toBeNull();
	});

	it("romanizes Korean and drops attached Latin words", async () => {
		expect(await romanizeOptionC("꽃을 피워 catwalking", "ko-Latn")).toBe(
			"kkocheul piwo",
		);
		expect(await romanizeOptionC("K-Pop을 사랑해", "ko-Latn")).toBe(
			"eul saranghae",
		);
	});

	it("romanizes Japanese kanji through the morphological analyzer", async () => {
		const res = await romanizeOptionC("未来へ 歩き出す Believe", "ja-Latn");
		expect(res).toContain("mirai");
		expect(res).toContain("aruki");
		expect(res).not.toContain("Believe");
	});

	it("romanizes Chinese as toneless pinyin and infers script when omitted", async () => {
		expect(await romanizeOptionC("我们 一起 Forever", "zh-Latn")).toBe(
			"wo men yi qi",
		);
		expect(await romanizeOptionC("我们")).toBe("wo men");
	});
});
