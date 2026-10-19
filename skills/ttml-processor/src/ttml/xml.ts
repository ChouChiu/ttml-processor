const ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&apos;",
};

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

export function escapeXml(str: string): string {
	return str.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

export function unescapeXml(str: string): string {
	return str.replace(
		/&(?:#x([\da-fA-F]+)|#(\d+)|(amp|lt|gt|quot|apos));/g,
		(match, hex?: string, dec?: string, named?: string) => {
			if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
			if (dec) return String.fromCodePoint(Number.parseInt(dec, 10));
			return (named && NAMED_ENTITIES[named]) || match;
		},
	);
}

const INDENT = "  ";
const OPEN_TAG_NAME = /^<([\w:.-]+)/;

function isOpeningTag(token: string): boolean {
	return (
		token.startsWith("<") &&
		!token.startsWith("</") &&
		!token.startsWith("<?") &&
		!token.startsWith("<!") &&
		!token.endsWith("/>")
	);
}

/**
 * Pretty-prints TTML with 2-space indentation; each <p> stays on one line so the
 * whitespace between syllable spans is never altered, and text-only elements stay inline
 */
export function formatTtml(xml: string): string {
	const tokens: string[] =
		xml
			.trim()
			.replace(/>\s*</g, "><")
			.match(/<[^>]+>|[^<]+/g) ?? [];
	const out: string[] = [];
	let depth = 0;
	const push = (line: string) => out.push(INDENT.repeat(depth) + line);

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i] as string;

		if (token === "<p>" || token.startsWith("<p ")) {
			const close = tokens.indexOf("</p>", i);
			const last = close === -1 ? tokens.length - 1 : close;
			push(tokens.slice(i, last + 1).join(""));
			i = last;
		} else if (token.startsWith("</")) {
			depth = Math.max(0, depth - 1);
			push(token);
		} else if (isOpeningTag(token)) {
			const name = OPEN_TAG_NAME.exec(token)?.[1];
			const text = tokens[i + 1];
			if (
				name &&
				text !== undefined &&
				!text.startsWith("<") &&
				tokens[i + 2] === `</${name}>`
			) {
				push(token + text + tokens[i + 2]);
				i += 2;
			} else {
				push(token);
				depth++;
			}
		} else {
			push(token);
		}
	}
	return `${out.join("\n")}\n`;
}
