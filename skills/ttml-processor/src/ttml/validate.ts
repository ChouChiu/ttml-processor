import { TTMLParser, toAmllLyrics } from "@applemusic-like-lyrics/ttml";
import { DOMParser } from "@xmldom/xmldom";
import type { CheerioAPI } from "cheerio";
import { NON_LATIN } from "../lang";
import type { ValidationResult } from "../types";
import {
	attrOf,
	childrenWithRole,
	lineAgent,
	lineKey,
	loadTtml,
	NAMESPACES,
	type Node$,
	ROLE,
	SELECTOR,
	splitAgentIds,
	sungText,
	textOf,
} from "./document";

class Report {
	readonly errors: string[] = [];
	readonly warnings: string[] = [];
	readonly info: string[] = [];

	error(msg: string) {
		this.errors.push(msg);
	}
	warn(msg: string) {
		this.warnings.push(msg);
	}
	note(msg: string) {
		this.info.push(msg);
	}
	result(): ValidationResult {
		return {
			valid: this.errors.length === 0,
			errors: this.errors,
			warnings: this.warnings,
			info: this.info,
		};
	}
}

export function parseTimestampToMs(value?: string): number | null {
	if (!value) return null;
	const parts = value.trim().replace(/s$/, "").split(":");
	if (parts.length > 3 || !parts.every((p) => /^\d+(?:\.\d+)?$/.test(p))) {
		return null;
	}
	return parts.reduce((total, p) => total * 60 + Number(p), 0) * 1000;
}

function isReversed(begin?: string, end?: string): boolean {
	const b = parseTimestampToMs(begin);
	const e = parseTimestampToMs(end);
	return b !== null && e !== null && b > e;
}

function checkAmllEngine(xml: string, report: Report): void {
	try {
		const amll = toAmllLyrics(
			TTMLParser.parse(xml, { domParser: new DOMParser() }),
		);
		report.note(
			`AMLL engine: ${amll.lines.length} lines, ${amll.metadata.length} metadata entries`,
		);
		if (amll.lines.some((l) => l.isDuet)) {
			report.warn(
				'Duet alert: AMLL flagged isDuet=true (split layout); declare <ttm:agent type="group"> for single-column scroll',
			);
		} else {
			report.note("AMLL duet guard: single-column layout (isDuet=false)");
		}
		if (amll.lines.some((l) => l.words?.some((w) => Boolean(w.romanWord)))) {
			report.note(
				"AMLL transliteration: syllable-synced (word.romanWord populated)",
			);
		}
	} catch (e) {
		report.warn(
			`AMLL engine parser note: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}

function checkNamespaces($: CheerioAPI, report: Report): void {
	const tt = $("tt");
	for (const [attr, uri] of Object.entries(NAMESPACES)) {
		if (tt.attr(attr) !== uri) {
			report.warn(`Missing namespace on <tt>: ${attr}='${uri}'`);
		}
	}
}

function checkMetadata($: CheerioAPI, report: Report): void {
	const head = $("head");
	if (head.length === 0) {
		report.error("Missing <head> element");
		return;
	}
	const metadata = head.children("metadata");
	if (metadata.length === 0) {
		report.error("Missing <metadata> element under <head>");
		return;
	}

	// Title validation
	const titleEl = metadata.find(SELECTOR.title).first();
	const titleText = textOf(titleEl).trim();
	if (titleEl.length === 0 || !titleText) {
		report.warn("Missing or empty <ttm:title> in metadata");
	}

	// AMLL metadata checks & duplicate key detection
	const amllKeys = new Map<string, number>();
	metadata.find(SELECTOR.amllMeta).each((_, el) => {
		const key = $(el).attr("key")?.trim();
		if (!key) return;
		amllKeys.set(key, (amllKeys.get(key) ?? 0) + 1);
		const val = attrOf($(el), "value")?.trim();
		if (!val) {
			report.warn(`Empty value for <amll:meta key="${key}">`);
		}
	});

	for (const [key, count] of amllKeys.entries()) {
		if (count > 1) {
			report.warn(
				`Duplicate <amll:meta> entry for key='${key}' (${count} times)`,
			);
		}
	}

	if (!amllKeys.has("musicName")) {
		report.warn('Missing essential <amll:meta key="musicName"> in metadata');
	}
	if (!amllKeys.has("artists")) {
		report.warn('Missing essential <amll:meta key="artists"> in metadata');
	}

	// AMLL vocals duplicate key detection
	const vocalKeys = new Map<string, number>();
	metadata.find("amll\\:vocals vocal, vocals vocal").each((_, el) => {
		const key = $(el).attr("key")?.trim();
		if (key) {
			vocalKeys.set(key, (vocalKeys.get(key) ?? 0) + 1);
		}
	});
	for (const [key, count] of vocalKeys.entries()) {
		if (count > 1) {
			report.warn(`Duplicate vocal key='${key}' in <amll:vocals>`);
		}
	}
}

function checkSongwriters($: CheerioAPI, report: Report): void {
	const itunes = $("head metadata").find(SELECTOR.itunesMeta);
	if (itunes.length === 0) {
		report.warn("Missing <iTunesMetadata> in metadata");
		return;
	}

	const songwritersBlock = itunes.find("songwriters, itunes\\:songwriters");
	if (songwritersBlock.length === 0) {
		report.warn(
			"Missing <songwriters> block in <iTunesMetadata>; lyricist and composer credits are required by Apple Music specification",
		);
		return;
	}

	const writers = songwritersBlock.find("songwriter, itunes\\:songwriter");
	if (writers.length === 0) {
		report.warn(
			"Empty <songwriters> block in <iTunesMetadata>; at least one <songwriter> is required",
		);
		return;
	}

	const seenWriters = new Map<string, number>();
	let validCount = 0;
	writers.each((_, el) => {
		const name = textOf($(el)).trim();
		if (!name) {
			report.warn("Empty <songwriter> entry in <songwriters>");
			return;
		}
		validCount++;
		const lower = name.toLowerCase();
		const count = (seenWriters.get(lower) ?? 0) + 1;
		seenWriters.set(lower, count);
		if (count === 2) {
			report.warn(`Duplicate songwriter '${name}' in <songwriters>`);
		}
	});

	if (validCount === 0) {
		report.warn("No valid songwriter names found in <songwriters>");
	}
}

function checkSections($: CheerioAPI, report: Report): void {
	const divs = $("body div");
	if (divs.length === 0) {
		report.warn(
			"No <div> under <body>; lines lack itunes:songPart organization",
		);
		return;
	}

	divs.each((i, el) => {
		const div = $(el);
		const label = `Section <div> #${i + 1}`;
		const begin = div.attr("begin");
		const end = div.attr("end");

		if (!div.attr("itunes:songPart")) {
			report.warn(`${label} missing itunes:songPart`);
		}
		if (!begin || !end) {
			report.warn(`${label} missing begin or end`);
		} else if (isReversed(begin, end)) {
			report.warn(
				`${label} timestamp error: begin ('${begin}') > end ('${end}')`,
			);
		}

		const lines = div.find("p");
		if (lines.length === 0) return;
		const firstBegin = lines.first().attr("begin");
		const lastEnd = lines.last().attr("end");
		if (begin && firstBegin && begin !== firstBegin) {
			report.warn(
				`${label} begin ('${begin}') mismatches first line begin ('${firstBegin}')`,
			);
		}
		if (end && lastEnd && end !== lastEnd) {
			report.warn(
				`${label} end ('${end}') mismatches last line end ('${lastEnd}')`,
			);
		}
	});
}

function checkAgents($: CheerioAPI, lines: Node$[], report: Report): void {
	const declared = new Set<string>();
	const seenAgents = new Map<string, number>();
	$("head metadata")
		.find(SELECTOR.agent)
		.each((_, el) => {
			const id = attrOf($(el), "xml:id", "id");
			if (!id) return;
			seenAgents.set(id, (seenAgents.get(id) ?? 0) + 1);
			declared.add(id);
			if ($(el).attr("type") === "person") {
				report.warn(
					`Duet alert: agent '${id}' declared as type='person'; use type='group' for single-column scroll`,
				);
			}
		});

	for (const [id, count] of seenAgents.entries()) {
		if (count > 1) {
			report.warn(
				`Duplicate agent declaration with xml:id='${id}' (${count} times)`,
			);
		}
	}

	lines.forEach((p, i) => {
		const agent = lineAgent(p);
		if (!agent || declared.has(agent)) return;
		const ids = splitAgentIds(agent);
		if (ids.length > 1 && ids.every((id) => declared.has(id))) {
			report.warn(
				`Line #${i + 1} uses compound agent '${agent}'; declaring <ttm:agent type="group" xml:id="${agent}"> is recommended`,
			);
		} else {
			report.error(`Line #${i + 1} references undeclared agent '${agent}'`);
		}
	});
}

const normalizedWords = (text: string) =>
	text
		.toLowerCase()
		.split(/\s+/)
		.map((w) => w.replace(/^\W+|\W+$/g, ""));

/** Option C forbids transliterating pure Latin lines or copying Latin words into x-roman */
function findOptionCViolation(sung: string, roman: string): string | null {
	if (!NON_LATIN.test(sung)) {
		return "pure Latin line should omit transliteration";
	}
	const romanWords = new Set(normalizedWords(roman));
	const leaked = normalizedWords(sung).filter(
		(w) => w.length >= 3 && /^[a-z0-9_-]+$/.test(w) && romanWords.has(w),
	);
	return leaked.length > 0
		? `unstripped words [${leaked.join(", ")}] in "${roman}"`
		: null;
}

function summarizeKeys(keys: string[]): string {
	return keys.length <= 4
		? keys.join(", ")
		: `${keys.slice(0, 3).join(", ")} ... ${keys.at(-1)}`;
}

/** Checks per-line timing, background vocals, Track A coverage and Option C; returns the Track A count */
function checkLines($: CheerioAPI, lines: Node$[], report: Report): number {
	const missingInline: string[] = [];
	const optionC: string[] = [];
	const seenLineKeys = new Map<string, number>();

	lines.forEach((p, i) => {
		const key = lineKey(p) ?? `line-${i + 1}`;
		const rawKey = lineKey(p);
		if (rawKey) {
			if (seenLineKeys.has(rawKey)) {
				report.warn(
					`Duplicate line key '${rawKey}' on line #${i + 1} (already used on line #${seenLineKeys.get(rawKey)})`,
				);
			} else {
				seenLineKeys.set(rawKey, i + 1);
			}
		}
		const label = `Line #${i + 1} (${key})`;
		const begin = p.attr("begin");
		const end = p.attr("end");

		if (isReversed(begin, end)) {
			report.warn(
				`${label} timestamp error: begin ('${begin}') > end ('${end}')`,
			);
		}
		p.find(SELECTOR.bg).each((_, bg) => {
			if (!textOf($(bg))) report.warn(`${label} has empty x-bg span`);
		});

		if (childrenWithRole(p, ROLE.translation).length === 0) {
			missingInline.push(key);
		}

		const roman = childrenWithRole(p, ROLE.roman);
		if (roman.length > 0) {
			const violation = findOptionCViolation(sungText(p, $), textOf(roman));
			if (violation) optionC.push(`${key}: ${violation}`);
		}
	});

	if (missingInline.length > 0) {
		report.warn(
			`Track A: ${missingInline.length} lines missing inline translation (${summarizeKeys(missingInline)})`,
		);
	}
	if (optionC.length > 0) {
		report.warn(
			`Option C: ${optionC.length} lines violate transliteration rules (${optionC[0]})`,
		);
	}
	return lines.length - missingInline.length;
}

/** Checks Track B coverage and returns the number of centralized translations */
function checkCentralTranslations(
	$: CheerioAPI,
	totalLines: number,
	report: Report,
): number {
	const keys = new Set<string>();
	const seenKeys = new Map<string, number>();
	$("head metadata")
		.find(SELECTOR.centralTranslation)
		.each((_, el) => {
			const key = $(el).attr("for");
			if (key) {
				keys.add(key);
				seenKeys.set(key, (seenKeys.get(key) ?? 0) + 1);
			}
		});

	for (const [key, count] of seenKeys.entries()) {
		if (count > 1) {
			report.warn(
				`Duplicate centralized translation entry for line '${key}' (${count} times)`,
			);
		}
	}

	if (keys.size < totalLines) {
		report.warn(
			`Track B centralized translations (${keys.size}) < total lines (${totalLines})`,
		);
	}
	return keys.size;
}

function checkCentralTransliterations(
	$: CheerioAPI,
	lines: Node$[],
	report: Report,
): void {
	const sungMap = new Map<string, string>();
	lines.forEach((p, i) => {
		const key = lineKey(p) ?? `L${i + 1}`;
		sungMap.set(key, sungText(p, $));
	});

	const seenTranslitKeys = new Map<string, number>();
	$(
		"head metadata transliterations transliteration text, head metadata itunes\\:transliterations itunes\\:transliteration itunes\\:text",
	).each((_, el) => {
		const key = $(el).attr("for");
		if (!key) return;
		seenTranslitKeys.set(key, (seenTranslitKeys.get(key) ?? 0) + 1);
		const sung = sungMap.get(key);
		if (!sung) return;

		// Option C rule 1: Pure Latin lines should omit transliterations completely
		if (!NON_LATIN.test(sung)) {
			report.warn(
				`Option C: pure Latin line '${key}' should omit transliteration: "${sung}"`,
			);
			return;
		}

		// Option C rule 2: Latin words must be stripped from transliterations
		const transText = $(el).text();
		const romanWords = new Set(normalizedWords(transText));
		const leaked = normalizedWords(sung).filter(
			(w) => w.length >= 3 && /^[a-z0-9_-]+$/.test(w) && romanWords.has(w),
		);
		if (leaked.length > 0) {
			report.warn(
				`Option C: Latin words [${leaked.join(", ")}] not stripped from transliteration '${key}'`,
			);
		}
	});

	for (const [key, count] of seenTranslitKeys.entries()) {
		if (count > 1) {
			report.warn(
				`Duplicate centralized transliteration entry for line '${key}' (${count} times)`,
			);
		}
	}
}

export function validateTtml(xml: string): ValidationResult {
	const report = new Report();
	checkAmllEngine(xml, report);

	let $: CheerioAPI;
	try {
		$ = loadTtml(xml);
	} catch (e) {
		report.error(
			`XML syntax parsing failed: ${e instanceof Error ? e.message : String(e)}`,
		);
		return report.result();
	}

	checkNamespaces($, report);
	checkMetadata($, report);
	checkSongwriters($, report);

	if ($("body").length === 0) {
		report.error("Missing <body> element");
		return report.result();
	}
	checkSections($, report);

	const lines = $("body p")
		.toArray()
		.map((p) => $(p));
	checkAgents($, lines, report);
	const trackA = checkLines($, lines, report);
	const trackB = checkCentralTranslations($, lines.length, report);
	checkCentralTransliterations($, lines, report);

	report.note(
		`Sections: ${$("body div").length} | Lines: ${lines.length} | Track A: ${trackA} | Track B: ${trackB}`,
	);
	return report.result();
}
