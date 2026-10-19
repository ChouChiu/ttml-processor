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

Execute this 5-phase procedure when processing TTML lyrics:

```bash
# Phase 1: Structure & Vocalist Discovery (Genius)
bun scripts/fetch_genius_parts.ts "<artist> <title>" --ttml

# Phase 2: Lightweight Export & Metadata Population
bun scripts/ttml_pipeline.ts export song.ttml -o workspace.json
bun scripts/fetch_song_meta.ts "<artist> <title>" --apply workspace.json

# Phase 3: Translation Crafting & Mandatory Agent Audit (Section 3)
# Fill lead ("translation") and ad-lib ("bg_translation") in workspace.json
# Strictly audit metadata accuracy, translation quality, and Option C transliteration rules

# Phase 4: Standardized Build & Romanization
bun scripts/ttml_pipeline.ts build song.ttml workspace.json -o completed.ttml [--no-roman] [--segment]

# Phase 5: Verification & Quality Assurance
bun scripts/validate_ttml.ts completed.ttml
bun test
bun run check
```

*(Note: Run commands from `skills/ttml-processor/`, or prefix paths with `skills/ttml-processor/` when working at the repository root).*

---

## 2. Workspace Schema (`workspace.json`)

Exporting raw TTML to `workspace.json` strips verbose syllable spans, reducing payload size by 70–95% while safeguarding syllable timing from accidental distortion:

```json
{
  "meta": {
    "title": "Song Title",
    "artists": "Official Release Artist",
    "album": "Album Name",
    "author": "GitHub Username",
    "translationLang": "zh-Hans",
    "romanLang": "ko-Latn",
    "songwriters": ["Lyricist 1", "Composer 1"],
    "extraAmllMeta": {},
    "agents": {
      "v1": "Vocalist 1",
      "v2": "Vocalist 2"
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

---

## 3. Mandatory Agent Audit Rules

AI Agents processing or generating TTML lyrics MUST strictly review and verify the following three dimensions before building and finalizing:

### 3.1 Lyric Metadata Audit
- **Recording Match & Platform IDs**: Verify candidate from `fetch_song_meta.ts`. Ensure match with official studio release; exclude Live, Remix, instrumental, or cover versions. Retain valid platform IDs (`qqMusicId`, `ncmMusicId`).
- **Title & Artist Normalization**: `title` and `artists` must reflect official release credits. Strip platform additions like `(Live)` or `(에스파)`.
- **Songwriters Presence (Mandatory)**: `<songwriters>` block is mandatory and must not be empty (Apple Music specification requirement). Must contain lyricist and composer credits; exclude arrangers and producers. Standardize spelling/casing; never fabricate or omit.
- **Vocalist Agent Declarations**: Replace placeholder keys in `workspace.json` (`"v1": "v1"`) with real vocalist names. All `<ttm:agent>` must declare `type="group"` to strictly prevent AMLL split-screen duet layout.
- **Key Uniqueness & Deduplication**: Enforce strict uniqueness across songwriters, agent IDs, line keys (`L1`, `L2`...), and AMLL metadata keys.
- **Preserve Manual Edits**: Never rerun `--apply` with `--force` after manual verification or corrections.

### 3.2 Translation Quality Audit (Xin Ya Da / 信 · 雅 · 达)
- **Zero-Copy & Independent Creation**: Translate strictly from scratch line by line. Never copy machine translations, web scraps, or external lyric sheets.
- **Direct Source Translation**: Translate directly from the original source language into the target language; never pivot through an intermediate language (e.g., no English pivot for Korean/Japanese songs).
- **Thematic Concept & Foreign Hook Localization**: Deeply align with album concept, universe lore, and musical attitude. Song titles, narrative keywords, and recurring foreign hooks must be translated into unified target expressions; never leave hooks untranslated simply because they are in English.
- **Diction Guardrails**:
  - *Eliminate AI Clichés*: Forbid hollow tropes ("浩瀚苍穹", "涅槃之火", "宿命羁绊", "浴火重生"). Ground imagery in concrete lyric nouns and actions (mirrors, neon lights, asphalt, petals).
  - *Eliminate Casual Chat*: Forbid lazy prose ("我好难过", "再喝一杯酒吧", "赶紧结束这一切"). Maintain stage tension, punchy verbs, and singable cadence.
- **Chants vs. Fillers**:
  - *Rhythmic Chants / Vocables / Onomatopoeia*: Artistically translate by meaning (意译) using sensory verbs and balanced four-character phrasing.
  - *Pure Acoustic Fillers*: Omit non-semantic breath releases and line-end sighs to keep subtitles poetic and readable.
- **Dual-Track 1:1 Coverage**: Ensure inline translations (Track A: `x-translation`) and central translations (Track B: `translations`) mirror 1:1 without omissions.

### 3.3 Transliteration Audit (Option C)
- **Strict Option C Compliance**:
  - Pure Latin / English lines **strictly omit transliterations** (`null`);
  - Mixed-language lines must thoroughly strip existing Latin words, transliterating non-Latin characters only.
- **Syllable Segmentation Smoothing (`--segment`)**:
  - Subdivide multi-character non-Latin words proportionally into single-character syllable spans with monotonic timestamps;
  - Trailing spaces attach strictly to word boundary syllables to preserve natural word spacing;
  - Populate timed spans in `<transliterations>` without creating static 3rd subtitle lines on `<p>`.
- **Background Vocal Isolation**: Background translations and transliterations must be nested strictly inside `<span ttm:role="x-bg">`, never leaking into lead vocals.

---

## 4. Architectural & Structural Invariants

| Feature | Invariant Rule | Technical Implementation |
| :--- | :--- | :--- |
| **Duet Prevention** | Prevent AMLL split-screen duet layout (`isDuet: true`) | Declare **all** agents with `type="group"` in `<metadata>`. Compound singers (`v1 v2`) are synthesized and registered automatically. |
| **Songwriters Presence** | Lyricist and composer credits required | `<iTunesMetadata><songwriters><songwriter>` must contain valid, deduplicated names. |
| **Unique Keys** | Avoid mapping collisions in playback engines | Every line `itunes:key` (`L1`, `L2`...), agent `xml:id`, and AMLL metadata key must be strictly unique. |
| **Song Parts** | Organize lines into structural musical sections | Continuous `<div itunes:songPart="..." begin="..." end="...">`. First line begin and last line end define div bounds. |
| **Option C Transliteration** | Transliterate non-Latin characters only | Pure Latin lines are **strictly omitted** (`null`). Mixed lines strip Latin words, transliterating only Korean, Japanese, or Chinese characters. |
| **Syllable Karaoke Sync** | Word-by-word Romaja/Pinyin without static 3rd line clutter | Timed spans in `<iTunesMetadata><transliterations>` populate AMLL `word.romanWord`. Suppress inline `<span ttm:role="x-roman">` on `<p>`. |
| **Dual-Track Translation** | Simultaneous support for AMLL & Apple Music | **Track A**: Inline `<span ttm:role="x-translation">` on every `<p>`.<br>**Track B**: Centralized `<iTunesMetadata><translations><translation><text for="L{N}">` covering 100% of lines. |
| **Background Vocals** | Ad-libs, chants, and secondary vocals | Nest inside `<span ttm:role="x-bg">`. Background translations and transliterations must be nested strictly inside `x-bg`. |
| **Clean Formatting** | Git-diffable, canonical TTML output | 2-space indentation, inline leaf tags, and preserved syllable whitespace. |

---

## 5. References & Specifications

- **Specification**: [references/ttml_spec.md](references/ttml_spec.md) (Full schema, metadata, and namespaces)
- **Translation Criteria**: [references/translation_and_style.md](references/translation_and_style.md) (Literary criteria and timing guardrails)
- **Duet Mechanics**: [references/agents_and_duet.md](references/agents_and_duet.md) (AMLL duet state machine and agent rules)
