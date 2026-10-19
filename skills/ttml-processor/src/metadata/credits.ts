/** Credit lines only appear in the header of an LRC, so later lines are never scanned */
const HEADER_LINES = 15;

const CREDIT_LINE = /^(?:\[[^\]]*\])*\s*([^:：[\]]{1,16}?)\s*[:：]\s*(.+?)\s*$/;

/** Platform-specific spellings of the same role, so credits from QQ and NetEase merge */
const ROLE_ALIASES: Record<string, string> = {
	词: "作词",
	作词: "作词",
	lyricist: "作词",
	lyrics: "作词",
	"written by": "作词",
	曲: "作曲",
	作曲: "作曲",
	composer: "作曲",
	music: "作曲",
	"composed by": "作曲",
	编曲: "编曲",
	arranger: "编曲",
	"arranged by": "编曲",
	制作人: "制作人",
	producer: "制作人",
	"produced by": "制作人",
};

const SONGWRITER_ROLES = new Set(["作词", "作曲"]);

/**
 * Unknown CJK labels (和声, 混音, ...) are kept verbatim; unknown Latin labels are
 * rejected so a lyric line like "Baby: ..." is never mistaken for a credit
 */
function normalizeRole(label: string): string | null {
	const role = ROLE_ALIASES[label.toLowerCase()];
	if (role) return role;
	return /[\u0080-￿]/.test(label) ? label : null;
}

function splitNames(value: string): string[] {
	return value
		.split(/\s*[/、,，&]\s*/)
		.map((name) => name.trim())
		.filter(Boolean);
}

/** Reads "作词 : A/B" style credit lines from the top of an LRC lyric, keyed by role */
export function parseLyricCredits(lrc: string): Record<string, string[]> {
	const credits: Record<string, string[]> = {};
	for (const line of lrc.split(/\r?\n/).slice(0, HEADER_LINES)) {
		const match = CREDIT_LINE.exec(line);
		const role = match?.[1] && normalizeRole(match[1]);
		const names = match?.[2] ? splitNames(match[2]) : [];
		if (role && names.length > 0) credits[role] = names;
	}
	return credits;
}

/** Lyricists then composers, deduplicated case-insensitively keeping the first spelling */
export function songwritersFrom(credits: Record<string, string[]>): string[] {
	const byKey = new Map<string, string>();
	for (const [role, names] of Object.entries(credits)) {
		if (!SONGWRITER_ROLES.has(role)) continue;
		for (const name of names) {
			if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name);
		}
	}
	return [...byKey.values()];
}
