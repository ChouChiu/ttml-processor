#!/usr/bin/env bun
import { CliError, runCli, runValidation } from "./shared";

runCli(() => {
	const [file] = process.argv.slice(2);
	if (!file)
		throw new CliError("Usage: bun scripts/validate_ttml.ts <file.ttml>");
	return runValidation(file) ? 0 : 1;
});
