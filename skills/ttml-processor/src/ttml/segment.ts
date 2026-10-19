import type { CheerioAPI } from "cheerio";
import { romanize as koromanize } from "koroman";
import { pinyin } from "pinyin-pro";
import { NON_LATIN } from "../lang";
import { parseTimestampToMs } from "./validate";

export interface SyllableSpan {
	begin: string;
	end: string;
	text: string;
}

/** Formats a millisecond timestamp preserving the template's format (clock MM:SS.mmm or seconds S.mmm) */
export function formatTimestamp(ms: number, template = "0:00.000"): string {
	const isClock = template.includes(":");
	const totalSeconds = ms / 1000;
	if (isClock) {
		const minutes = Math.floor(totalSeconds / 60);
		const secs = totalSeconds - minutes * 60;
		const wholeSecs = Math.floor(secs);
		const millis = Math.round((secs - wholeSecs) * 1000);
		return `${minutes}:${String(wholeSecs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
	}
	return totalSeconds.toFixed(3);
}

/**
 * Extracts official transliteration spans from raw Apple Music TTML <transliterations> block if present.
 */
export function extractRawTransliterations(
	$: CheerioAPI,
): Record<string, { lead: SyllableSpan[]; bg: SyllableSpan[] }> {
	const transMap: Record<string, { lead: SyllableSpan[]; bg: SyllableSpan[] }> =
		{};

	$("transliteration text").each((_, textEl) => {
		const key = $(textEl).attr("for");
		if (!key) return;

		const lead: SyllableSpan[] = [];
		const bg: SyllableSpan[] = [];

		$(textEl)
			.children("span")
			.each((_, spanEl) => {
				const role = $(spanEl).attr("ttm:role");
				if (role === "x-bg") {
					const innerSpans = $(spanEl).find("span");
					if (innerSpans.length > 0) {
						innerSpans.each((_, bgSpan) => {
							bg.push({
								begin: $(bgSpan).attr("begin") || "",
								end: $(bgSpan).attr("end") || "",
								text: $(bgSpan).text(),
							});
						});
					} else {
						bg.push({
							begin: $(spanEl).attr("begin") || "",
							end: $(spanEl).attr("end") || "",
							text: $(spanEl).text(),
						});
					}
				} else {
					lead.push({
						begin: $(spanEl).attr("begin") || "",
						end: $(spanEl).attr("end") || "",
						text: $(spanEl).text(),
					});
				}
			});

		transMap[key] = { lead, bg };
	});

	return transMap;
}

/**
 * Romanizes a single non-Latin character.
 */
function romanizeSingleChar(char: string, _lang?: string): string {
	if (/[가-힣]/.test(char)) {
		return koromanize(char);
	}
	if (/[\u4e00-\u9fa5]/.test(char)) {
		return pinyin(char, { toneType: "none", nonZh: "removed" }).trim();
	}
	return char;
}

/**
 * Segments a multi-character CJK/Hangul span into single-character syllable spans,
 * proportionally subdividing timestamps and aligning 1:1 with Roman tokens.
 *
 * Strictly complies with Option C: Latin spans emit no transliterations.
 */
export function segmentSpan(
	bodySpan: SyllableSpan,
	transSpan?: SyllableSpan,
	lang?: string,
): { body: SyllableSpan[]; trans: SyllableSpan[] } {
	const rawText = bodySpan.text;
	const cleanText = rawText.trim();

	// Option C: Pure Latin / alphanumeric spans strictly emit no transliteration
	if (!NON_LATIN.test(cleanText)) {
		const bCopy = { ...bodySpan, text: cleanText };
		return { body: [bCopy], trans: [] };
	}

	const nonLatinChars =
		cleanText.match(new RegExp(NON_LATIN.source, "g")) ?? [];

	// Single non-Latin character: keep as 1 span with non-Latin romanization
	if (nonLatinChars.length === 1) {
		const bCopy = { ...bodySpan, text: cleanText };
		const tText = transSpan
			? transSpan.text.replace(/^[()]+|[()]+$/g, "").trim()
			: romanizeSingleChar(nonLatinChars[0] ?? cleanText, lang);
		const tCopy = {
			begin: bodySpan.begin,
			end: bodySpan.end,
			text: tText,
		};
		return { body: [bCopy], trans: [tCopy] };
	}

	const romanTokens = transSpan
		? transSpan.text
				.replace(/^[()]+|[()]+$/g, "")
				.trim()
				.split(/\s+/)
				.filter(Boolean)
		: [];

	const N = nonLatinChars.length;
	const startMs = parseTimestampToMs(bodySpan.begin);
	const endMs = parseTimestampToMs(bodySpan.end);

	// When start and end timestamps are valid and clean text consists of non-Latin characters
	if (startMs !== null && endMs !== null && cleanText.length === N) {
		const durMs = endMs - startMs;
		const bList: SyllableSpan[] = [];
		const tList: SyllableSpan[] = [];

		const hasMatchingTokens = romanTokens.length === N;

		for (let k = 0; k < N; k++) {
			const subStartMs = startMs + Math.round((k * durMs) / N);
			const subEndMs = startMs + Math.round(((k + 1) * durMs) / N);
			const subBegin = formatTimestamp(subStartMs, bodySpan.begin);
			const subEnd = formatTimestamp(subEndMs, bodySpan.end);

			const charText = nonLatinChars[k] ?? "";
			const romText = hasMatchingTokens
				? (romanTokens[k] ?? "")
				: romanizeSingleChar(charText, lang);

			bList.push({ begin: subBegin, end: subEnd, text: charText });
			tList.push({ begin: subBegin, end: subEnd, text: romText });
		}

		return { body: bList, trans: tList };
	}

	return {
		body: [{ ...bodySpan, text: cleanText }],
		trans: [
			{
				begin: bodySpan.begin,
				end: bodySpan.end,
				text: transSpan
					? transSpan.text.replace(/^[()]+|[()]+$/g, "").trim()
					: cleanText,
			},
		],
	};
}

/**
 * Assigns trailing spaces to syllable spans based on a reference spaced text.
 * Trailing whitespace is only attached to word-boundary tokens, never inside words.
 */
export function assignTrailingSpaces(
	spans: SyllableSpan[],
	referenceText: string,
): void {
	let refIdx = 0;
	for (const span of spans) {
		const cleanSpan = span.text.trim().replace(/^[()]+|[()]+$/g, "");
		if (!cleanSpan) continue;
		const foundAt = referenceText.indexOf(cleanSpan, refIdx);
		if (foundAt !== -1) {
			refIdx = foundAt + cleanSpan.length;
			if (refIdx < referenceText.length && referenceText[refIdx] === " ") {
				span.text = `${span.text.trim()} `;
				while (refIdx < referenceText.length && referenceText[refIdx] === " ") {
					refIdx++;
				}
			} else {
				span.text = span.text.trim();
			}
		}
	}
}
