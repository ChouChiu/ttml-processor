import { agentElement } from "../ttml/document";
import { escapeXml } from "../ttml/xml";
import type { ParsedLyricsData } from "../types";
import { ENSEMBLE } from "./parser";

const ENSEMBLE_AGENT_ID = "v1000";

function resolveAgentId(
	singers: string[],
	ids: Map<string, string>,
): string | null {
	if (singers.length === 1 && singers[0] === ENSEMBLE) return ENSEMBLE_AGENT_ID;
	const resolved = singers.flatMap((s) => ids.get(s) ?? []);
	return resolved.length > 0 ? resolved.join(" ") : null;
}

/** Copy-paste TTML: group agent declarations, AMLL vocals and one <div> stub per section */
export function generateTtmlSkeleton(data: ParsedLyricsData): string {
	const singers = data.unique_singers.filter((s) => s !== ENSEMBLE);
	const ids = new Map(singers.map((s, i) => [s, `v${i + 1}`]));
	const names = new Map([...ids].map(([name, id]) => [id, name]));
	const sectionAgents = data.sections.map((sec) =>
		resolveAgentId(sec.singers, ids),
	);

	const agents = new Map(names);
	for (const id of sectionAgents) {
		if (id?.includes(" ") && !agents.has(id)) {
			agents.set(
				id,
				id
					.split(" ")
					.map((v) => names.get(v))
					.join(", "),
			);
		}
	}
	if (singers.length > 1 || sectionAgents.includes(ENSEMBLE_AGENT_ID)) {
		agents.set(ENSEMBLE_AGENT_ID, ENSEMBLE);
	}

	const out = [...agents].map(([id, name]) => agentElement(id, name));
	out.push(
		"\n<amll:vocals>",
		...singers.map(
			(s, i) => `  <vocal key="${i + 1}" value="${escapeXml(s)}"/>`,
		),
		"</amll:vocals>\n",
	);

	data.sections.forEach((sec, i) => {
		const agent = sectionAgents[i];
		const agentAttr = agent ? ` ttm:agent="${agent}"` : "";
		out.push(
			`<div begin="..." end="..." itunes:songPart="${escapeXml(sec.itunes_part)}">`,
			`  <p begin="..." end="..." itunes:key="L..."${agentAttr}>...</p>`,
			"</div>\n",
		);
	});
	return out.join("\n");
}
