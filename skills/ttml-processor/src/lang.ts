export type Script = "ko" | "ja" | "zh";
export type Lang = Script | "latin";

const HANGUL = "\\uac00-\\ud7a3\\u1100-\\u11ff\\u3130-\\u318f";
const KANA = "\\u3040-\\u30ff";
const HAN = "\\u3400-\\u4dbf\\u4e00-\\u9fff";

const HAS_SCRIPT: Record<Script, RegExp> = {
	ko: new RegExp(`[${HANGUL}]`),
	ja: new RegExp(`[${KANA}]`),
	zh: new RegExp(`[${HAN}]`),
};

/** Matches any character that Option C would transliterate */
export const NON_LATIN = new RegExp(`[${HANGUL}${KANA}${HAN}]`);

/** Contiguous runs of characters transliterated for each script */
export const SCRIPT_RUNS: Record<Script, RegExp> = {
	ko: new RegExp(`[${HANGUL}]+`, "g"),
	ja: new RegExp(`[${KANA}${HAN}]+`, "g"),
	zh: new RegExp(`[${HAN}]+`, "g"),
};

const ROMAN_LANG_TAGS: Record<Script, string> = {
	ko: "ko-Latn",
	ja: "ja-Latn",
	zh: "zh-Latn",
};

/** BCP 47 "undetermined" tag, used when a song has nothing to transliterate */
const UNDETERMINED_ROMAN_TAG = "und-Latn";

export function normalizeLanguage(lang?: string | null): Lang | null {
	if (!lang) return null;
	const l = lang.toLowerCase().trim();
	if (l.startsWith("ko")) return "ko";
	if (l.startsWith("ja")) return "ja";
	if (l.startsWith("zh") || l === "chinese") return "zh";
	if (l.startsWith("latin") || l.startsWith("en")) return "latin";
	return null;
}

export function detectLyricLanguage(text: string): Lang {
	if (HAS_SCRIPT.ko.test(text)) return "ko";
	if (HAS_SCRIPT.ja.test(text)) return "ja";
	if (HAS_SCRIPT.zh.test(text)) return "zh";
	return "latin";
}

export function detectSongLanguage(lines: string[]): Lang {
	const count = (script: Script) =>
		lines.filter((l) => HAS_SCRIPT[script].test(l)).length;
	const ko = count("ko");
	const kana = count("ja");
	// Hangul and Kana are script-unique; Han alone indicates Chinese
	if (ko > 0 && ko >= kana) return "ko";
	if (kana > 0) return "ja";
	if (count("zh") > 0) return "zh";
	return "latin";
}

export function getTtmlLangTag(lang: string): string {
	const norm = normalizeLanguage(lang);
	return norm && norm !== "latin"
		? ROMAN_LANG_TAGS[norm]
		: UNDETERMINED_ROMAN_TAG;
}
