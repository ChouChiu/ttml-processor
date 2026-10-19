import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkspaceData } from "../src/types";

const EXAMPLES = join(import.meta.dir, "..", "examples");

export const readExample = (name: string) =>
	readFileSync(join(EXAMPLES, name), "utf-8");

export const sampleRaw = () => readExample("sample_raw.ttml");
export const sampleCompleted = () => readExample("sample_completed.ttml");
export const sampleWorkspace = (): WorkspaceData =>
	JSON.parse(readExample("sample_workspace.json"));

/** Minimal namespaced TTML document around the given metadata and body markup */
export function ttml(metadata: string, body: string): string {
	return `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:amll="http://www.example.com/ns/amll">
  <head><metadata>${metadata}</metadata></head>
  <body>${body}</body>
</tt>`;
}
