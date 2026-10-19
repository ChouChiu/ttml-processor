import * as cheerio from "cheerio";
import { type AnyNode, type Element, isTag, isText } from "domhandler";
import type { WorkspaceMeta } from "../types";
import { escapeXml, unescapeXml } from "./xml";

export type Node$ = cheerio.Cheerio<Element>;

export const NAMESPACES = {
	xmlns: "http://www.w3.org/ns/ttml",
	"xmlns:ttm": "http://www.w3.org/ns/ttml#metadata",
	"xmlns:itunes": "http://music.apple.com/lyric-ttml-internal",
	"xmlns:tts": "http://www.w3.org/ns/ttml#styling",
	"xmlns:amll": "http://www.example.com/ns/amll",
} as const;

export const ROLE = {
	translation: "x-translation",
	roman: "x-roman",
	bg: "x-bg",
} as const;

/** Spans the pipeline regenerates on every build */
const ANNOTATION_ROLES = new Set<string>([ROLE.translation, ROLE.roman]);
/** Spans whose text is not part of the lead vocal */
const NON_LEAD_ROLES = new Set<string>([...ANNOTATION_ROLES, ROLE.bg]);

/** AMLL meta keys that map onto dedicated workspace fields */
export const AMLL_META_FIELDS = {
	musicName: "title",
	artists: "artists",
	album: "album",
	ttmlAuthorGithub: "author",
} as const satisfies Record<string, keyof WorkspaceMeta>;

export const DEFAULT_PART = "Verse";
export const DEFAULT_TRANSLATION_LANG = "zh-Hans";

export const SELECTOR = {
	title: "ttm\\:title, title",
	agent: "ttm\\:agent, agent",
	amllMeta: "amll\\:meta, meta",
	itunesMeta: "itunes\\:iTunesMetadata, iTunesMetadata",
	songwriter:
		"songwriters songwriter, itunes\\:songwriters itunes\\:songwriter",
	centralTranslation:
		"translations text, itunes\\:translations itunes\\:text, itunes\\:translations text",
	bg: `span[ttm\\:role='${ROLE.bg}']`,
} as const;

/** Raw entities are kept so untouched syllable spans serialize byte-for-byte */
export function loadTtml(xml: string): cheerio.CheerioAPI {
	return cheerio.load(xml, { xml: { decodeEntities: false } });
}

export function roleOf(node: AnyNode): string | undefined {
	return isTag(node) ? node.attribs["ttm:role"] : undefined;
}

export function childrenWithRole(el: Node$, role: string): Node$ {
	return el.children().filter((_, c) => roleOf(c) === role);
}

export function removeAnnotations(el: Node$): void {
	el.children()
		.filter((_, c) => ANNOTATION_ROLES.has(roleOf(c) ?? ""))
		.remove();
}

/** Decoded text content, since documents are loaded without entity decoding */
export function textOf(el: cheerio.Cheerio<AnyNode>): string {
	return unescapeXml(el.text()).trim();
}

export function attrOf(
	el: cheerio.Cheerio<AnyNode>,
	...names: string[]
): string | undefined {
	for (const name of names) {
		const value = el.attr(name);
		if (value) return unescapeXml(value);
	}
	return undefined;
}

export const lineKey = (p: Node$) => attrOf(p, "itunes:key", "key");
export const lineAgent = (p: Node$) => attrOf(p, "ttm:agent", "agent");

export function splitAgentIds(agent?: string): string[] {
	return agent ? agent.split(/\s+/).filter(Boolean) : [];
}

/** Sung text of an element's own syllables, excluding annotations and background vocals */
export function sungText(el: Node$, $: cheerio.CheerioAPI): string {
	const parts: string[] = [];
	el.contents().each((_, node) => {
		if (isText(node)) parts.push(node.data);
		else if (isTag(node) && !NON_LEAD_ROLES.has(roleOf(node) ?? "")) {
			parts.push($(node).text());
		}
	});
	return unescapeXml(parts.join("")).replace(/\s+/g, " ").trim();
}

export function agentElement(id: string, name: string): string {
	return `<ttm:agent type="group" xml:id="${escapeXml(id)}"><ttm:name type="full">${escapeXml(name)}</ttm:name></ttm:agent>`;
}
