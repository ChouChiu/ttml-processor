import type { CheerioAPI } from "cheerio";
import { detectSongLanguage, getTtmlLangTag } from "../lang";
import type { WorkspaceData, WorkspaceLine, WorkspaceMeta } from "../types";
import {
	AMLL_META_FIELDS,
	attrOf,
	childrenWithRole,
	DEFAULT_PART,
	DEFAULT_TRANSLATION_LANG,
	lineAgent,
	lineKey,
	loadTtml,
	type Node$,
	ROLE,
	SELECTOR,
	splitAgentIds,
	sungText,
	textOf,
} from "./document";

type HeaderMeta = Omit<WorkspaceMeta, "translationLang" | "romanLang">;

function readHeader($: CheerioAPI): HeaderMeta {
	const metadata = $("head metadata");
	const header: HeaderMeta = {
		title: textOf(metadata.find(SELECTOR.title).first()),
		artists: "",
		album: "",
		author: "",
		songwriters: [],
		extraAmllMeta: {},
		agents: {},
	};

	metadata.find(SELECTOR.amllMeta).each((_, el) => {
		const key = $(el).attr("key");
		if (!key) return;
		const value = attrOf($(el), "value") ?? "";
		const field = AMLL_META_FIELDS[key as keyof typeof AMLL_META_FIELDS];
		if (field) header[field] = value;
		else if (header.extraAmllMeta) header.extraAmllMeta[key] = value;
	});

	metadata.find(SELECTOR.agent).each((_, el) => {
		const id = attrOf($(el), "xml:id", "id");
		if (id) header.agents[id] = textOf($(el).find("ttm\\:name, name")) || id;
	});

	metadata.find(SELECTOR.songwriter).each((_, el) => {
		const name = textOf($(el));
		if (name) header.songwriters?.push(name);
	});

	return header;
}

function readCentralTranslations($: CheerioAPI): Map<string, string> {
	const translations = new Map<string, string>();
	$("head metadata")
		.find(SELECTOR.centralTranslation)
		.each((_, el) => {
			const key = $(el).attr("for");
			if (key) translations.set(key, textOf($(el)));
		});
	return translations;
}

function readLine(
	p: Node$,
	$: CheerioAPI,
	index: number,
	central: Map<string, string>,
): WorkspaceLine {
	const key = lineKey(p) ?? `L${index + 1}`;
	const line: WorkspaceLine = {
		key,
		part: attrOf(p.closest("div"), "itunes:songPart") ?? DEFAULT_PART,
		agent: lineAgent(p) ?? "",
		text: sungText(p, $),
		translation:
			central.get(key) || textOf(childrenWithRole(p, ROLE.translation)),
	};

	const bg = p.find(SELECTOR.bg).first();
	const bgText = bg.length > 0 ? sungText(bg, $) : "";
	if (bgText) {
		line.bg_text = bgText;
		line.bg_translation = textOf(childrenWithRole(bg, ROLE.translation));
	}
	return line;
}

/** Strips syllable timing from a TTML document, keeping only the editable text */
export function exportWorkspace(xml: string): WorkspaceData {
	const $ = loadTtml(xml);
	const header = readHeader($);
	const central = readCentralTranslations($);
	const lines = $("body p")
		.toArray()
		.map((p, i) => readLine($(p), $, i, central));

	// Lines may reference agents the header never declared
	for (const id of lines.flatMap((l) => splitAgentIds(l.agent))) {
		header.agents[id] ??= id;
	}

	const sung = lines.flatMap((l) => [l.text, l.bg_text ?? ""]);
	const { title, artists, album, author, ...rest } = header;
	const meta: WorkspaceMeta = {
		title,
		artists,
		album,
		author,
		translationLang: DEFAULT_TRANSLATION_LANG,
		romanLang: getTtmlLangTag(detectSongLanguage(sung)),
		...rest,
	};
	return { meta, lines };
}
