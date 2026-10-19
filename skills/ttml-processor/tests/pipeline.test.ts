import { describe, expect, it } from "bun:test";
import { buildTtml } from "../src/ttml/build";
import { exportWorkspace } from "../src/ttml/export";
import { formatTtml } from "../src/ttml/xml";
import { sampleCompleted, sampleRaw, sampleWorkspace, ttml } from "./helpers";

describe("export", () => {
	it("extracts text, background vocals and undeclared agents from raw TTML", () => {
		const { meta, lines } = exportWorkspace(sampleRaw());
		expect(meta).toMatchObject({
			title: "Supernova",
			artists: "aespa",
			romanLang: "ko-Latn",
			agents: { v1: "v1", v2: "v2" },
		});
		expect(lines.map((l) => [l.key, l.agent, l.text, l.bg_text])).toEqual([
			["L1", "v1", "꽃을 피워 catwalking", undefined],
			["L2", "v1 v2", "Watch how I let it all unfold", "(일라)"],
		]);
	});

	it("recovers the workspace from a completed TTML", () => {
		const expected = sampleWorkspace();
		expected.meta.agents["v1 v2"] = "Karina, Winter";
		expect(exportWorkspace(sampleCompleted())).toEqual(expected);
	});
});

describe("build", () => {
	it("reproduces the completed example from raw TTML and workspace", async () => {
		expect(await buildTtml(sampleRaw(), sampleWorkspace())).toBe(
			sampleCompleted(),
		);
	});

	it("is idempotent when rebuilding a completed file", async () => {
		const completed = sampleCompleted();
		expect(await buildTtml(completed, exportWorkspace(completed))).toBe(
			completed,
		);
	});

	it("omits transliterations when romanization is disabled", async () => {
		const out = await buildTtml(sampleRaw(), sampleWorkspace(), {
			romanize: false,
		});
		expect(out).not.toContain("x-roman");
		expect(out).not.toContain("<transliterations>");
	});

	it("escapes special characters once and decodes them on export", async () => {
		const source = ttml(
			"",
			'<p begin="1.0" end="2.0" itunes:key="L1"><span begin="1.0" end="2.0">Rock &amp; Roll</span></p>',
		);
		const workspace = exportWorkspace(source);
		expect(workspace.lines[0]?.text).toBe("Rock & Roll");

		workspace.meta.title = "R&B <Live>";
		for (const line of workspace.lines) line.translation = "摇滚 & 乐";
		const out = await buildTtml(source, workspace);
		expect(out).toContain("<ttm:title>R&amp;B &lt;Live&gt;</ttm:title>");
		expect(out).toContain('<text for="L1">摇滚 &amp; 乐</text>');
		expect(exportWorkspace(out).lines[0]?.translation).toBe("摇滚 & 乐");
	});

	it("fills missing line bounds from syllables and groups consecutive parts", async () => {
		const source = ttml(
			"",
			[1, 2, 3]
				.map(
					(n) =>
						`<p itunes:key="L${n}"><span begin="${n}.0" end="${n}.5">la</span></p>`,
				)
				.join(""),
		);
		const workspace = exportWorkspace(source);
		const parts = ["Verse", "Verse", "Chorus"];
		workspace.lines.forEach((l, i) => {
			l.part = parts[i] ?? "Verse";
		});
		const out = await buildTtml(source, workspace);
		expect(out).toContain(
			'<div itunes:songPart="Verse" begin="1.0" end="2.5">',
		);
		expect(out).toContain(
			'<div itunes:songPart="Chorus" begin="3.0" end="3.5">',
		);
		expect(out).toContain('<p itunes:key="L1" begin="1.0" end="1.5">');
	});

	it("inserts word spaces the workspace text adds between joined syllables", async () => {
		const syllables = ["Imma", "get", "&apos;em", "beau", "ti", "ful"]
			.map((t, i) => `<span begin="${i}.0" end="${i}.5">${t}</span>`)
			.join("");
		const bg =
			'<span ttm:role="x-bg"><span begin="6.0" end="6.5">(oh</span><span begin="6.5" end="7.0">yeah)</span></span>';
		const source = ttml("", `<p itunes:key="L1">${syllables}${bg}</p>`);
		const workspace = exportWorkspace(source);
		expect(workspace.lines[0]?.text).toBe("Immaget'embeautiful");

		const line = workspace.lines[0];
		if (!line) throw new Error("missing line");
		line.text = "Imma get 'em beautiful";
		line.bg_text = "(oh yeah)";
		const out = await buildTtml(source, workspace, { romanize: false });
		expect(exportWorkspace(out).lines[0]).toMatchObject({
			text: "Imma get 'em beautiful",
			bg_text: "(oh yeah)",
		});
		expect(out).toContain('<span begin="2.0" end="2.5">&apos;em </span>');
		expect(out).toContain('<span begin="3.0" end="3.5">beau</span>');
		expect(out).toContain('<span begin="5.0" end="5.5">ful</span>');
	});

	it("leaves syllables untouched when the workspace text changes letters", async () => {
		const source = ttml(
			"",
			'<p itunes:key="L1"><span begin="0.0" end="0.5">Imma</span><span begin="0.5" end="1.0">get</span></p>',
		);
		const workspace = exportWorkspace(source);
		const line = workspace.lines[0];
		if (!line) throw new Error("missing line");
		line.text = "I'mma get";
		const out = await buildTtml(source, workspace, { romanize: false });
		expect(exportWorkspace(out).lines[0]?.text).toBe("Immaget");
	});
});

describe("formatTtml", () => {
	it("keeps <p> on one line so syllable whitespace survives", () => {
		const xml =
			"<tt><body><div><p><span>a </span><span>b</span></p></div></body></tt>";
		expect(formatTtml(xml)).toBe(
			"<tt>\n  <body>\n    <div>\n      <p><span>a </span><span>b</span></p>\n    </div>\n  </body>\n</tt>\n",
		);
	});
});
