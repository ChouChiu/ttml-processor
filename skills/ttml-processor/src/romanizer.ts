import { romanize as koromanize } from "koroman";
import Kuroshiro from "kuroshiro";
import { pinyin } from "pinyin-pro";
import { toRomaji } from "wanakana";
import {
	detectLyricLanguage,
	normalizeLanguage,
	SCRIPT_RUNS,
	type Script,
} from "./lang";

let kuroshiro: Promise<Kuroshiro | null> | undefined;

/** Lazily loads the kuromoji dictionary once; resolves null if it fails to load */
function loadKuroshiro(): Promise<Kuroshiro | null> {
	kuroshiro ??= (async () => {
		const { default: KuromojiAnalyzer } = await import(
			"kuroshiro-analyzer-kuromoji"
		);
		const instance = new Kuroshiro();
		await instance.init(new KuromojiAnalyzer());
		return instance;
	})().catch(() => null);
	return kuroshiro;
}

async function romanizeRun(run: string, script: Script): Promise<string> {
	switch (script) {
		case "ko":
			return koromanize(run);
		case "zh":
			return pinyin(run, { toneType: "none", nonZh: "removed" });
		case "ja": {
			const k = await loadKuroshiro();
			return k
				? k.convert(run, {
						to: "romaji",
						mode: "spaced",
						romajiSystem: "hepburn",
					})
				: toRomaji(run);
		}
	}
}

function resolveScript(text: string, preferredLang?: string): Script | null {
	const preferred = normalizeLanguage(preferredLang);
	const lang =
		preferred && preferred !== "latin" ? preferred : detectLyricLanguage(text);
	return lang === "latin" ? null : lang;
}

/**
 * Option C transliteration: only non-Latin runs are romanized and Latin words are
 * dropped, so pure Latin lines return null
 */
export async function romanizeOptionC(
	text: string,
	preferredLang?: string,
): Promise<string | null> {
	const script = resolveScript(text, preferredLang);
	if (!script) return null;

	const runs = text.match(SCRIPT_RUNS[script]) ?? [];
	const parts = await Promise.all(runs.map((r) => romanizeRun(r, script)));
	const result = parts.join(" ").replace(/\s+/g, " ").trim();
	return result || null;
}
