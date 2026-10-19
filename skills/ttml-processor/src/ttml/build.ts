import type { CheerioAPI } from "cheerio";
import { detectSongLanguage, getTtmlLangTag } from "../lang";
import { romanizeOptionC } from "../romanizer";
import type { WorkspaceData, WorkspaceLine, WorkspaceMeta } from "../types";
import {
	AMLL_META_FIELDS,
	agentElement,
	DEFAULT_PART,
	DEFAULT_TRANSLATION_LANG,
	lineKey,
	loadTtml,
	NAMESPACES,
	type Node$,
	ROLE,
	removeAnnotations,
	SELECTOR,
	splitAgentIds,
} from "./document";
import { escapeXml, formatTtml } from "./xml";

export interface BuildOptions {
	/** Generate Option C transliterations (default true) */
	romanize?: boolean;
}

interface LineContext {
	translationLang: string;
	romanLang: string;
	romanize: boolean;
}

/** Central Track B entries, collected per line in document order */
interface CentralTracks {
	translations: string[];
	transliterations: string[];
}

function ensureMetadata($: CheerioAPI): Node$ {
	const tt = $("tt");
	for (const [attr, uri] of Object.entries(NAMESPACES)) {
		if (!tt.attr(attr)) tt.attr(attr, uri);
	}
	if (tt.children("head").length === 0) tt.prepend("<head></head>");
	const head = tt.children("head");
	if (head.children("metadata").length === 0)
		head.append("<metadata></metadata>");
	return head.children("metadata");
}

/** Declared agents plus a combined agent for every compound id such as "v1 v2" */
function withCompoundAgents(
	declared: Record<string, string>,
	lines: WorkspaceLine[],
): Record<string, string> {
	const agents = { ...declared };
	for (const { agent } of lines) {
		const ids = splitAgentIds(agent);
		if (agent && ids.length > 0 && !agents[agent]) {
			agents[agent] = ids.map((id) => agents[id] || id).join(", ");
		}
	}
	return agents;
}

function headerElements(
	meta: Partial<WorkspaceMeta>,
	lines: WorkspaceLine[],
): string[] {
	// Every agent is a group so AMLL never switches to the split duet layout
	const agents = Object.entries(
		withCompoundAgents(meta.agents ?? {}, lines),
	).map(([id, name]) => agentElement(id, name));

	const amllMeta = [
		...Object.entries(AMLL_META_FIELDS).map(
			([key, field]) => [key, meta[field]] as const,
		),
		...Object.entries(meta.extraAmllMeta ?? {}).filter(
			([key]) => !(key in AMLL_META_FIELDS),
		),
	].flatMap(([key, value]) =>
		value
			? [`<amll:meta key="${escapeXml(key)}" value="${escapeXml(value)}"/>`]
			: [],
	);

	const vocals = Object.entries(meta.agents ?? {})
		.filter(([id]) => !id.includes(" ") && id.toLowerCase() !== "all")
		.map(([, name], i) => `<vocal key="${i + 1}" value="${escapeXml(name)}"/>`);

	return [
		...agents,
		...amllMeta,
		...(vocals.length > 0
			? [`<amll:vocals>${vocals.join("")}</amll:vocals>`]
			: []),
	];
}

/** Rewrites title, agents and AMLL meta, keeping them ahead of any iTunesMetadata */
function writeHeader(
	metadata: Node$,
	meta: Partial<WorkspaceMeta>,
	lines: WorkspaceLine[],
): void {
	if (meta.title) {
		metadata.find(SELECTOR.title).remove();
		metadata.prepend(`<ttm:title>${escapeXml(meta.title)}</ttm:title>`);
	}

	metadata
		.find(`${SELECTOR.agent}, ${SELECTOR.amllMeta}, amll\\:vocals, vocals`)
		.remove();
	const markup = headerElements(meta, lines).join("");
	const itunes = metadata.children(SELECTOR.itunesMeta).first();
	if (itunes.length > 0) itunes.before(markup);
	else metadata.append(markup);
}

/** Returns iTunesMetadata with songwriters refreshed and stale Track B blocks removed */
function resetItunesMetadata(metadata: Node$, songwriters?: string[]): Node$ {
	if (metadata.find(SELECTOR.itunesMeta).length === 0) {
		metadata.append(
			`<iTunesMetadata xmlns="${NAMESPACES["xmlns:itunes"]}"></iTunesMetadata>`,
		);
	}
	const itunes = metadata.find(SELECTOR.itunesMeta);

	if (songwriters && songwriters.length > 0) {
		itunes.find("songwriters, itunes\\:songwriters").remove();
		const tags = songwriters.map(
			(name) => `<songwriter>${escapeXml(name)}</songwriter>`,
		);
		itunes.prepend(`<songwriters>${tags.join("")}</songwriters>`);
	}

	itunes
		.find(
			"translations, itunes\\:translations, transliterations, itunes\\:transliterations",
		)
		.remove();
	return itunes;
}

function annotationSpan(role: string, lang: string, text: string): string {
	return `<span ttm:role="${role}" xml:lang="${escapeXml(lang)}">${escapeXml(text)}</span>`;
}

function annotate(
	el: Node$,
	translation: string,
	roman: string | null,
	ctx: LineContext,
): void {
	removeAnnotations(el);
	if (translation) {
		el.append(
			annotationSpan(ROLE.translation, ctx.translationLang, translation),
		);
	}
	if (roman) el.append(annotationSpan(ROLE.roman, ctx.romanLang, roman));
}

/** Writes Track A spans on the line and its background vocals, returning the lead texts */
async function annotateLine(
	p: Node$,
	line: WorkspaceLine,
	ctx: LineContext,
): Promise<{ translation: string; roman: string | null }> {
	if (line.agent) p.attr("ttm:agent", escapeXml(line.agent));

	const translation = line.translation?.trim() ?? "";
	const roman = ctx.romanize
		? await romanizeOptionC(line.text ?? "", ctx.romanLang)
		: null;
	annotate(p, translation, roman, ctx);

	const bg = p.find(SELECTOR.bg);
	if (bg.length > 0) {
		const bgRoman =
			ctx.romanize && line.bg_text
				? await romanizeOptionC(line.bg_text, ctx.romanLang)
				: null;
		annotate(bg, line.bg_translation?.trim() ?? "", bgRoman, ctx);
	}
	return { translation, roman };
}

/** Fills missing line bounds from the first and last timed syllables */
function resolveLineBounds(p: Node$): { begin: string; end: string } {
	const bound = (attr: "begin" | "end", span: Node$) => {
		const own = p.attr(attr);
		if (own) return own;
		const inherited = span.attr(attr) ?? "";
		if (inherited) p.attr(attr, inherited);
		return inherited;
	};
	return {
		begin: bound("begin", p.find("span[begin]").first()),
		end: bound("end", p.find("span[end]").last()),
	};
}

/** Regroups every <p> into one songPart <div> per run of consecutive lines sharing a part */
async function rebuildBody(
	$: CheerioAPI,
	lines: WorkspaceLine[],
	ctx: LineContext,
): Promise<CentralTracks> {
	const body = $("body");
	const paragraphs = body
		.find("p")
		.toArray()
		.map((p) => $(p));
	body.empty();

	const byKey = new Map(lines.map((l) => [l.key, l]));
	const tracks: CentralTracks = { translations: [], transliterations: [] };
	let section: { part: string; div: Node$ } | undefined;

	for (const [i, p] of paragraphs.entries()) {
		let key = lineKey(p);
		if (!key) {
			key = `L${i + 1}`;
			p.attr("itunes:key", key);
		}
		const line = byKey.get(key) ??
			lines[i] ?? {
				key,
				part: DEFAULT_PART,
				agent: "",
				text: "",
				translation: "",
			};

		const { translation, roman } = await annotateLine(p, line, ctx);
		const entry = (text: string) =>
			`<text for="${escapeXml(key)}">${escapeXml(text)}</text>`;
		if (translation) tracks.translations.push(entry(translation));
		if (roman) tracks.transliterations.push(entry(roman));

		const { begin, end } = resolveLineBounds(p);
		const part = line.part || DEFAULT_PART;
		if (section?.part !== part) {
			body.append(
				`<div itunes:songPart="${escapeXml(part)}" begin="${escapeXml(begin)}" end="${escapeXml(end)}"></div>`,
			);
			section = { part, div: body.children("div").last() };
		}
		section.div.append(p);
		if (end) section.div.attr("end", end);
	}
	return tracks;
}

function centralBlock(
	kind: "translation" | "transliteration",
	lang: string,
	entries: string[],
): string {
	return `<${kind}s><${kind} xml:lang="${escapeXml(lang)}">${entries.join("")}</${kind}></${kind}s>`;
}

/** Merges workspace edits back into the timed source TTML and returns the formatted document */
export async function buildTtml(
	sourceXml: string,
	workspace: WorkspaceData,
	{ romanize = true }: BuildOptions = {},
): Promise<string> {
	const meta: Partial<WorkspaceMeta> = workspace.meta ?? {};
	const lines = workspace.lines ?? [];
	const ctx: LineContext = {
		translationLang: meta.translationLang || DEFAULT_TRANSLATION_LANG,
		romanLang:
			meta.romanLang ||
			getTtmlLangTag(detectSongLanguage(lines.map((l) => l.text))),
		romanize,
	};

	const $ = loadTtml(sourceXml);
	const metadata = ensureMetadata($);
	writeHeader(metadata, meta, lines);
	const itunes = resetItunesMetadata(metadata, meta.songwriters);

	const tracks = await rebuildBody($, lines, ctx);
	if (tracks.translations.length > 0) {
		itunes.append(
			centralBlock("translation", ctx.translationLang, tracks.translations),
		);
	}
	if (tracks.transliterations.length > 0) {
		itunes.append(
			centralBlock("transliteration", ctx.romanLang, tracks.transliterations),
		);
	}
	return formatTtml($.xml());
}
