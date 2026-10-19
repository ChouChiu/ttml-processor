import { existsSync, readFileSync } from "node:fs";
import { validateTtml } from "../src/ttml/validate";
import type { ValidationResult } from "../src/types";

export class CliError extends Error {}

export function readTextFile(path: string, label: string): string {
	if (!existsSync(path)) throw new CliError(`${label} not found: ${path}`);
	return readFileSync(path, "utf-8");
}

export function printValidation(result: ValidationResult): void {
	for (const msg of result.info) console.log(`  [INFO] ${msg}`);
	for (const msg of result.warnings) console.log(`  [WARN] ${msg}`);
	for (const msg of result.errors) console.error(`  [ERROR] ${msg}`);
	console.log("-".repeat(50));
	if (!result.valid) {
		console.log("[FAIL] Validation failed with blocking errors");
	} else if (result.warnings.length > 0) {
		console.log("[PASS WITH WARNINGS] Format is valid, review warnings above");
	} else {
		console.log(
			"[PASS] Complies with Apple Music TTML and AMLL specifications",
		);
	}
}

/** Validates a file, prints the report and returns whether it passed */
export function runValidation(path: string): boolean {
	const xml = readTextFile(path, "TTML file");
	console.log(`[CHECK] Validating TTML: ${path}`);
	const result = validateTtml(xml);
	printValidation(result);
	return result.valid;
}

/** Runs a CLI entry point, turning thrown errors into a one-line message and exit code 1 */
export function runCli(
	main: () => Promise<number | undefined> | number | undefined,
) {
	Promise.resolve()
		.then(main)
		.then((code) => process.exit(code ?? 0))
		.catch((err: unknown) => {
			console.error(
				`[ERROR] ${err instanceof Error ? err.message : String(err)}`,
			);
			process.exit(1);
		});
}
