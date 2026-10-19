---
name: ttml-processor
description: >-
  Comprehensive Apple Music TTML and AMLL synchronized lyrics processor. Use when creating,
  editing, validating, translating (Faithfulness-Elegance-Expressiveness / 信雅达), adding Option C transliterations,
  attributing singers (duet prevention via type=group), structuring song parts (itunes:songPart),
  or configuring background vocals (x-bg) and AMLL metadata in TTML files (*.ttml).
---

# Apple Music & AMLL TTML Lyrics Engineering Master Guide

Standard engineering specification and automated workflow for authoring, translating, romanizing, and validating synchronized TTML lyrics (`*.ttml`) compliant with Apple Music and AMLL (Apple Music-like Lyrics) playback engines.

---

## 1. End-to-End 5-Phase Workflow

Always follow this 5-phase procedure when processing TTML lyrics:

```
[Phase 1: Lore & Structure Discovery]
  ├── Research album concept & artist worldview
  └── bun scripts/fetch_genius_parts.ts "<artist> <title>" --ttml
             │
[Phase 2: Lightweight Export & Metadata Review]
  ├── bun scripts/ttml_pipeline.ts export song.ttml -o workspace.json
  ├── bun scripts/fetch_song_meta.ts "<artist> <title>" --apply workspace.json
  └── Review and correct "meta" by hand (see Metadata Review below)
             │
[Phase 3: Translation Crafting (Xin Ya Da)]
  ├── Zero-Copy Independent Creation
  ├── Diction Guardrails (Eliminate AI pompous tropes & crude chat)
  └── Write translations into workspace.json ("translation" & "bg_translation")
             │
[Phase 4: Standardized Build & Romanization]
  └── bun scripts/ttml_pipeline.ts build song.ttml workspace.json -o completed.ttml [--no-roman] [--segment]
             │
[Phase 5: Automated Verification & Linting]
  ├── bun scripts/validate_ttml.ts completed.ttml
  └── bun test
```

*(Note: Run commands from the skill directory `skills/ttml-processor/`, or prefix paths with `skills/ttml-processor/` when at the repository root).*

---

## 2. Workspace Schema (`workspace.json`)

Exporting raw TTML to `workspace.json` strips verbose millisecond syllable spans, reducing payload size by 70–95% while safeguarding original timing against accidental tampering:

```json
{
  "meta": {
    "title": "Song Title",
    "artists": "Official Release Artist",
    "album": "Album Name",
    "author": "GitHub Username",
    "translationLang": "zh-Hans",
    "romanLang": "ko-Latn",
    "songwriters": ["Songwriter 1", "Songwriter 2"],
    "extraAmllMeta": {},
    "agents": {
      "v1": "Singer 1",
      "v2": "Singer 2"
    }
  },
  "lines": [
    {
      "key": "L1",
      "part": "Verse",
      "agent": "v1",
      "text": "꽃을 피워 catwalking",
      "translation": "繁花盛放 步步傲然穿行"
    },
    {
      "key": "L2",
      "part": "Chorus",
      "agent": "v1 v2",
      "text": "Watch how I let it all unfold",
      "translation": "且看我如何让万物全数破晓",
      "bg_text": "(일라)",
      "bg_translation": "(快苏醒吧)"
    }
  ]
}
```

### Key Field Responsibilities:
- `meta.agents`: Dictionary mapping agent IDs (`v1`, `v2`, etc.) to vocalist display names. Undeclared IDs found on lines are auto-discovered during export.
- `lines[i].part`: Musical section name. Consecutive lines sharing the same `part` are automatically wrapped in a continuous `<div itunes:songPart="...">`.
- `lines[i].translation`: Lead vocal translation.
- `lines[i].bg_text`: Background vocal / ad-lib text (if present).
- `lines[i].bg_translation`: Background vocal translation (nested strictly inside `<span ttm:role="x-bg">`).

### Metadata Review

`fetch_song_meta.ts` copies raw QQ Music and NetEase data into `meta`. Treat it as a draft: review every field and edit `workspace.json` directly before building.

1. **Verify the match**: Check the candidate list printed on stderr. If the starred pick is a live, remix, MV or cover version, rerun with `--select <n>` or pass the song URL. Remove a `qqMusicId` / `ncmMusicId` that points to a different recording.
2. **`title`**: Use the official title. Strip platform suffixes such as `(Live)` or `(MV音频版)` unless they are part of the release name.
3. **`artists`**: Use the artist exactly as credited on the release (`aespa`, not `aespa (에스파)`). Separate joint artists with `, `.
4. **`album`**: Use the release the timed audio comes from. Platforms often return the pre-release single instead of the full album (e.g. `Supernova` vs `Armageddon - The 1st Album`). Ask the user when it is unclear.
5. **`songwriters`**: List lyricists first, then composers. Normalize names to their commonly credited form (`Dem Jointz`, not `Dwayne "Dem Jointz" Abernathy Jr.`), merge case and spelling variants, and leave out arrangers and producers.
6. **`agents`**: Replace auto-discovered placeholders (`"v1": "v1"`) with real vocalist names from the Genius section credits.
7. **No invention**: When the platforms, Genius and the official release disagree and nothing settles it, keep the existing value and point it out to the user. Never fabricate credits.
8. **Preserve edits**: `--apply` only fills empty fields, but `--force` overwrites everything. Never rerun with `--force` after manual corrections.

Report every corrected field to the user in one short list after the review.

---

## 3. Translation & Diction Guardrails (Xin Ya Da / 信 · 雅 · 达)

Adhere strictly to the literary quality guidelines:

1. **Context & Lore Alignment**:
   - Investigate the artist's conceptual lore (e.g., virtual avatars, cyberpunk dystopian motifs, cinematic universes, vulnerability vs. defiance).
   - Metaphors must map to concrete thematic nouns and verbs rather than generic embellishments.
2. **Eliminate "AI-Generated" Pompous Clichés**:
   - Strictly forbid hollow tropes like "浩瀚苍穹", "涅槃之火", "绝世容颜", "宿命羁绊", "浴火重生".
   - Ground imagery directly in the physical lyrics (mirrors, neon lights, asphalt, petals, lightning).
3. **Eliminate Chatty / Crude Colloquialisms**:
   - Strictly forbid degrading stage-ready lines into casual conversational logs (e.g., "我好难过", "再喝一杯酒吧", "赶紧结束这一切").
   - Maintain stage tension, rhythmic bite, and acoustic flow suitable for live performance.
4. **Zero-Copy Rule**:
   - Strictly prohibit copying or borrowing machine translations, web scraps, or external templates. Every song translation is an independent piece of art created from scratch.
5. **Direct Source Translation & Thematic Keyword Localization**:
   - Translate straight from the original language into the target language; never pivot through an intermediate language.
   - Core thematic keywords, recurring foreign hooks, and song title terms must be translated into resonant target-language concepts aligned with the track's narrative lore, never left untranslated.
6. **Artistic 意译 for Chants vs. Subtitle Omission for Fillers**:
   - Percussive chants, kinetic sound-effect words, and phonetic puns carry sonic momentum and should be artistically translated by meaning (意译) using vivid sensory verbs and rhythmic phrasing to preserve live stage tension.
   - Pure decorative acoustic filler particles carrying no narrative meaning (e.g., breath releases, syncopation syllables at phrase ends) should be omitted from the translation to maintain clean, singable, and poetic subtitles.
7. **Syllable-Level Segmentation & Space Preservation (`--segment`)**:
   - When segmenting multi-character non-Latin words into single-character spans, subdivide timestamps proportionally by character count and duration.
   - Trailing spaces must attach strictly to the final character of each word, ensuring natural inter-word spacing is preserved without word merging.
   - Transliterations are structured as timed spans `<span begin="..." end="...">` in `<iTunesMetadata><transliterations>`, cleanly populating syllable boxes in editors and players without creating static 3rd subtitle lines.
8. **Word Spacing Alignment**:
   - When adjacent word spans lack separating whitespace in source TTML, adjust the workspace text spacing so the pipeline automatically appends trailing spaces to the boundary syllables.

---

## 4. Architectural & Structural Invariants

| Feature | Standard Rule | Technical Implementation |
| :--- | :--- | :--- |
| **Duet Prevention** | Prevent AMLL split-screen duet layout (`isDuet: true`) | Declare **all** agents with `type="group"` in `<metadata>`. Compound singers (e.g. `v1 v2`) are automatically synthesized and registered. |
| **Song Parts** | Organize lines into structural musical sections | Continuous `<div itunes:songPart="..." begin="..." end="...">`. First line begin and last line end define div bounds. |
| **Option C Transliteration** | Transliterate non-Latin characters only | Pure English lines are **strictly omitted** (`null`). Mixed lines strip Latin words, transliterating only Korean (`koroman`), Japanese (`kuroshiro` + `kuromoji`), or Chinese (`pinyin-pro`). |
| **Syllable Karaoke Sync** | Word-by-word Romaja/Pinyin without static 3rd line | Timed spans in `<iTunesMetadata><transliterations><transliteration><text for="L{N}"><span begin="..." end="...">roman</span>` populate `word.romanWord` in AMLL. Suppress inline `<span ttm:role="x-roman">` on `<p>`. |
| **Dual-Track Translation** | Simultaneous support for AMLL & Apple Music | **Track A**: Inline `<span ttm:role="x-translation">` on every `<p>`.<br>**Track B**: Centralized `<iTunesMetadata><translations><translation><text for="L{N}">` covering 100% of lines. |
| **Background Vocals** | Ad-libs, chants, and secondary vocals | Nest inside `<span ttm:role="x-bg">`. Background translations and transliterations must be nested strictly inside `x-bg`. |
| **Clean Formatting** | Beautiful, git-diffable TTML | Formatted with 2-space indentation, inline leaf tags, and preserved syllable whitespace. |

---

## 5. CLI Tools & Verification Reference

```bash
# Export raw TTML into workspace JSON (printed to stdout without -o)
bun scripts/ttml_pipeline.ts export <input.ttml> [-o <workspace.json>]

# Search Genius for song structure, vocalists, and TTML skeleton
bun scripts/fetch_genius_parts.ts "<artist> <title>" [--ttml] [--lyrics]

# Fetch title, artists, album, songwriters and qqMusicId / ncmMusicId from QQ Music and NetEase
bun scripts/fetch_song_meta.ts "<artist> <title> | song url" [--source qq|netease|all] [--apply workspace.json] [--force] [--json]

# Build completed TTML from workspace JSON (add --segment for syllable-level CJK segmentation)
bun scripts/ttml_pipeline.ts build <input.ttml> <workspace.json> -o <output.ttml> [--no-roman] [--segment]

# Validate TTML syntax, AMLL duet status, namespaces, and translations
bun scripts/validate_ttml.ts <file.ttml>

# Run tests, then lint and typecheck
bun test
bun run check
```

---

## 6. Project References & Examples

- **Sample Input**: [examples/sample_raw.ttml](examples/sample_raw.ttml)
- **Sample Workspace**: [examples/sample_workspace.json](examples/sample_workspace.json)
- **Sample Output**: [examples/sample_completed.ttml](examples/sample_completed.ttml)
- **Specification**: [references/ttml_spec.md](references/ttml_spec.md) (Full schema & namespaces)
- **Translation Criteria**: [references/translation_and_style.md](references/translation_and_style.md) (Detailed literary criteria)
- **Duet Mechanics**: [references/agents_and_duet.md](references/agents_and_duet.md) (AMLL duet state machine)

