#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildTtml } from "../src/ttml/build";
import { exportWorkspace } from "../src/ttml/export";
import type { WorkspaceData } from "../src/types";
import { CliError, readTextFile, runCli, runValidation } from "./shared";

const USAGE = `Usage: bun scripts/ttml_pipeline.ts <command> [options]

Commands:
  export <input.ttml> [-o <workspace.json>]    Print or save the editable workspace JSON
  build <input.ttml> <workspace.json> -o <output.ttml> [--no-roman] [--segment]
  validate <file.ttml>`;

function exportCommand(input: string, output?: string): number {
	const xml = readTextFile(input, "Source TTML");
	const workspace = exportWorkspace(xml);
	const json = JSON.stringify(workspace, null, 2);

	const reduction =
		(1 - Buffer.byteLength(json) / Math.max(1, Buffer.byteLength(xml))) * 100;
	console.error(
		`[EXPORT] ${workspace.lines.length} lines | Roman lang: ${workspace.meta.romanLang} | Size reduction: ${reduction.toFixed(1)}%`,
	);

	if (output) {
		writeFileSync(output, `${json}\n`, "utf-8");
		console.error(`[EXPORT] Saved JSON: ${output}`);
	} else {
		console.log(json);
	}
	return 0;
}

async function buildCommand(
	input: string,
	workspacePath: string,
	output: string,
	romanize: boolean,
	segment: boolean,
): Promise<number> {
	const xml = readTextFile(input, "Source TTML");
	const workspace = JSON.parse(
		readTextFile(workspacePath, "Workspace JSON"),
	) as WorkspaceData;

	writeFileSync(
		output,
		await buildTtml(xml, workspace, { romanize, segment }),
		"utf-8",
	);
	console.log(`[BUILD] Generated TTML: ${output}`);
	return runValidation(output) ? 0 : 1;
}

runCli(async () => {
	const { positionals, values } = parseArgs({
		args: process.argv.slice(2),
		allowPositionals: true,
		options: {
			output: { type: "string", short: "o" },
			"no-roman": { type: "boolean", default: false },
			segment: { type: "boolean", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
	});
	const [command, first, second] = positionals;

	if (values.help || !command) {
		console.log(USAGE);
		return values.help ? 0 : 1;
	}
	if (command === "export" && first) {
		return exportCommand(first, values.output);
	}
	if (command === "build" && first && second && values.output) {
		return buildCommand(
			first,
			second,
			values.output,
			!values["no-roman"],
			Boolean(values.segment),
		);
	}
	if (command === "validate" && first) {
		return runValidation(first) ? 0 : 1;
	}
	throw new CliError(`Invalid arguments\n\n${USAGE}`);
});
