import type { CheerioAPI } from "cheerio";
import { romanize as koromanize } from "koroman";
import { pinyin } from "pinyin-pro";
import { NON_LATIN } from "../lang";
import type { SyllableSpan, WorkspaceLine } from "../types";
import { type Node$, ROLE, SELECTOR } from "./document";
import { formatTimestamp, parseTimestampToMs } from "./time";
import { escapeXml } from "./xml";

export type { SyllableSpan };
export { formatTimestamp };

export interface SegmentLineContext {
	translationLang: string;
	romanLang: string;
	romanize: boolean;
	rawTrans: Record<string, { lead: SyllableSpan[]; bg: SyllableSpan[] }>;
}

/**
 * Extracts official transliteration spans from raw Apple Music TTML <transliterations> block.
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
				if (role === ROLE.bg) {
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

/** Romanizes a single non-Latin character */
function romanizeSingleChar(char: string, _lang?: string): string {
	if (/[가-힣]/.test(char)) return koromanize(char);
	if (/[\u4e00-\u9fa5]/.test(char)) {
		return pinyin(char, { toneType: "none", nonZh: "removed" }).trim();
	}
	return char;
}

/**
 * Segments a multi-character CJK/Hangul span into single-character syllable spans,
 * proportionally subdividing timestamps and aligning 1:1 with Roman tokens.
 * Complies strictly with Option C: Latin spans emit no transliterations.
 */
export function segmentSpan(
	bodySpan: SyllableSpan,
	transSpan?: SyllableSpan,
	lang?: string,
): { body: SyllableSpan[]; trans: SyllableSpan[] } {
	const cleanText = bodySpan.text.trim();

	// Option C: Pure Latin / alphanumeric spans strictly emit no transliteration
	if (!NON_LATIN.test(cleanText)) {
		return { body: [{ ...bodySpan, text: cleanText }], trans: [] };
	}

	const nonLatinChars =
		cleanText.match(new RegExp(NON_LATIN.source, "g")) ?? [];

	// Single non-Latin character: keep as 1 span with non-Latin romanization
	if (nonLatinChars.length === 1) {
		const tText = transSpan
			? transSpan.text.replace(/^[()]+|[()]+$/g, "").trim()
			: romanizeSingleChar(nonLatinChars[0] ?? cleanText, lang);
		return {
			body: [{ ...bodySpan, text: cleanText }],
			trans: [{ begin: bodySpan.begin, end: bodySpan.end, text: tText }],
		};
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

/** Wraps a span list in parentheses for background vocal styling */
export function wrapWithParentheses(spans: SyllableSpan[]): void {
	if (spans.length === 0 || !spans[0]) return;
	if (!spans[0].text.startsWith("(")) {
		spans[0].text = `(${spans[0].text}`;
	}
	const last = spans[spans.length - 1];
	if (last) {
		const endsWithSpace = last.text.endsWith(" ");
		const trimmed = last.text.trim();
		if (!trimmed.endsWith(")")) {
			last.text = `${trimmed})${endsWithSpace ? " " : ""}`;
		}
	}
}

/** Mirrors trailing word whitespace from source spans onto aligned transliteration spans */
export function mirrorTrailingSpaces(
	sourceSpans: SyllableSpan[],
	targetSpans: SyllableSpan[],
): void {
	for (const tSpan of targetSpans) {
		const matching = sourceSpans.find(
			(b) => b.begin === tSpan.begin && b.end === tSpan.end,
		);
		if (matching?.text.endsWith(" ")) {
			tSpan.text = `${tSpan.text.trim()} `;
		} else {
			tSpan.text = tSpan.text.trim();
		}
	}
}

/** Extracts lead and background vocal syllable spans from a paragraph */
export function extractSyllablesFromParagraph(
	p: Node$,
	$: CheerioAPI,
): { lead: SyllableSpan[]; bg: SyllableSpan[] } {
	const lead: SyllableSpan[] = [];
	p.children("span")
		.not(
			`[ttm\\:role='${ROLE.bg}'], [ttm\\:role='${ROLE.translation}'], [ttm\\:role='${ROLE.roman}']`,
		)
		.each((_, s) => {
			lead.push({
				begin: $(s).attr("begin") || "",
				end: $(s).attr("end") || "",
				text: $(s).text(),
			});
		});

	const bg: SyllableSpan[] = [];
	const bgEl = p.find(SELECTOR.bg).first();
	if (bgEl.length > 0) {
		const inner = bgEl
			.find("span")
			.not(`[ttm\\:role='${ROLE.translation}'], [ttm\\:role='${ROLE.roman}']`);
		if (inner.length > 0) {
			inner.each((_, s) => {
				bg.push({
					begin: $(s).attr("begin") || "",
					end: $(s).attr("end") || "",
					text: $(s).text(),
				});
			});
		} else {
			bg.push({
				begin: bgEl.attr("begin") || "",
				end: bgEl.attr("end") || "",
				text: bgEl.text(),
			});
		}
	}
	return { lead, bg };
}

/**
 * Reconstructs a single paragraph with syllable-segmented spans, trailing spaces,
 * background vocals, inline translation, and Track B entries.
 */
export function rebuildSegmentedLine(
	p: Node$,
	line: WorkspaceLine,
	ctx: SegmentLineContext,
	tracks: { translations: string[]; transliterations: string[] },
	$: CheerioAPI,
): void {
	const key = p.attr("itunes:key") || line.key;
	const rt = ctx.rawTrans[key] || { lead: [], bg: [] };
	const { lead: leadSpans, bg: bgSpans } = extractSyllablesFromParagraph(p, $);

	// Segment spans proportionally
	const segLeadSpans: SyllableSpan[] = [];
	const transLeadSpans: SyllableSpan[] = [];
	for (let i = 0; i < leadSpans.length; i++) {
		const s = leadSpans[i];
		if (!s) continue;
		const res = segmentSpan(s, rt.lead[i], ctx.romanLang);
		segLeadSpans.push(...res.body);
		transLeadSpans.push(...res.trans);
	}

	const segBgSpans: SyllableSpan[] = [];
	const transBgSpans: SyllableSpan[] = [];
	for (let i = 0; i < bgSpans.length; i++) {
		const s = bgSpans[i];
		if (!s) continue;
		const res = segmentSpan(s, rt.bg[i], ctx.romanLang);
		segBgSpans.push(...res.body);
		transBgSpans.push(...res.trans);
	}

	// Assign trailing spaces from reference text
	if (line.text) assignTrailingSpaces(segLeadSpans, line.text);
	if (line.bg_text) assignTrailingSpaces(segBgSpans, line.bg_text);

	// Mirror trailing spaces to transliteration spans
	mirrorTrailingSpaces(segLeadSpans, transLeadSpans);
	mirrorTrailingSpaces(segBgSpans, transBgSpans);

	// Parentheses on background vocals
	wrapWithParentheses(segBgSpans);
	wrapWithParentheses(transBgSpans);

	// Populate paragraph DOM
	p.empty();
	if (line.agent) p.attr("ttm:agent", escapeXml(line.agent));
	for (const s of segLeadSpans) {
		p.append(
			`<span begin="${escapeXml(s.begin)}" end="${escapeXml(s.end)}">${escapeXml(s.text)}</span>`,
		);
	}
	if (segBgSpans.length > 0) {
		const bgMarkup = segBgSpans
			.map(
				(s) =>
					`<span begin="${escapeXml(s.begin)}" end="${escapeXml(s.end)}">${escapeXml(s.text)}</span>`,
			)
			.join("");
		const bgTrans = line.bg_translation?.trim()
			? `<span ttm:role="x-translation" xml:lang="${escapeXml(ctx.translationLang)}">${escapeXml(line.bg_translation.trim())}</span>`
			: "";
		p.append(`<span ttm:role="x-bg">${bgMarkup}${bgTrans}</span>`);
	}
	if (line.translation?.trim()) {
		p.append(
			`<span ttm:role="x-translation" xml:lang="${escapeXml(ctx.translationLang)}">${escapeXml(line.translation.trim())}</span>`,
		);
		tracks.translations.push(
			`<text for="${escapeXml(key)}">${escapeXml(line.translation.trim())}</text>`,
		);
	}

	if (ctx.romanize && (transLeadSpans.length > 0 || transBgSpans.length > 0)) {
		const renderSpan = (s: SyllableSpan) =>
			`<span begin="${escapeXml(s.begin)}" end="${escapeXml(s.end)}">${escapeXml(s.text)}</span>`;
		const leadMarkup = transLeadSpans.map(renderSpan).join("");
		const bgMarkup =
			transBgSpans.length > 0
				? `<span ttm:role="x-bg">${transBgSpans.map(renderSpan).join("")}</span>`
				: "";
		tracks.transliterations.push(
			`<text for="${escapeXml(key)}">${leadMarkup}${bgMarkup}</text>`,
		);
	}
}
