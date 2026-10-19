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

Always execute this 5-phase procedure when processing TTML lyrics:

```bash
# Phase 1: Structure & Vocalist Discovery
bun scripts/fetch_genius_parts.ts "<artist> <title>" --ttml

# Phase 2: Lightweight Export & Metadata Population
bun scripts/ttml_pipeline.ts export song.ttml -o workspace.json
bun scripts/fetch_song_meta.ts "<artist> <title>" --apply workspace.json
# (Review & correct workspace.json metadata per Section 2 checklist)

# Phase 3: Translation Crafting (Xin Ya Da)
# Write lead ("translation") and ad-lib ("bg_translation") into workspace.json

# Phase 4: Standardized Build & Romanization
bun scripts/ttml_pipeline.ts build song.ttml workspace.json -o completed.ttml [--no-roman] [--segment]

# Phase 5: Verification & Linting
bun scripts/validate_ttml.ts completed.ttml
bun test
bun run check
```

*(Note: Run commands from `skills/ttml-processor/`, or prefix paths with `skills/ttml-processor/` from workspace root).*

---

## 2. Workspace Schema (`workspace.json`) & Metadata Checklist

Exporting raw TTML to `workspace.json` strips verbose syllable spans, reducing payload size by 70–95% while protecting syllable timing from accidental edits:

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

### Strict Metadata Verification Checklist

Review and correct `workspace.json` metadata before Phase 4:

1. **Recording Match & Platform IDs**: Verify candidate from `fetch_song_meta.ts`. If a live/remix/cover version was matched, pass the exact song URL or rerun with `--select <n>`. Strip mismatched `qqMusicId` / `ncmMusicId`.
2. **Metadata Accuracy**:
   - `title`: Official release title. Strip platform tags like `(Live)` or `(MV音频版)`.
   - `artists`: Official release artist (`aespa`, not `aespa (에스파)`). Separate multiple artists with `, `.
   - `album`: Official album matching the timed audio release.
3. **Songwriters Presence (词曲作者必填)**:
   - `songwriters` array **must not be empty**. Apple Music specification requires lyricist and composer credits.
   - List lyricists first, then composers. Exclude arrangers and producers.
   - Normalize names to common official forms (`Dem Jointz`, not full legal names).
   - If not returned by music platforms, manually search and add credits from album liner notes or official sources.
4. **Strict Deduplication (去重约束)**:
   - **Songwriters**: Deduplicate names case-insensitively (e.g. `["KENZIE", "kenzie"]` -> `["KENZIE"]`).
   - **Agents**: Agent IDs (`v1`, `v2`) must be unique. Replace placeholder keys (`"v1": "v1"`) with real singer names from Genius credits.
   - **Line Keys**: Every `key` (`L1`, `L2`...) must be unique across all lines.
   - **AMLL Metadata**: Keys in `extraAmllMeta` must not duplicate core fields (`musicName`, `artists`, `album`, `ttmlAuthorGithub`).
5. **No Invention**: Never fabricate credits. Preserve manual corrections; never rerun `--apply` with `--force` after manual editing.

---

## 3. Translation Guardrails (Xin Ya Da / 信 · 雅 · 达)

Adhere strictly to literary and rhythmic translation standards:

1. **Zero-Copy & Independent Creation**: Translate strictly from scratch. Never copy machine translations, web scraps, or external lyric sheets.
2. **Direct Source Translation**: Translate directly from the original source language into the target language; never translate through an intermediate language (e.g., no English pivot for Korean/Japanese songs).
3. **Thematic Localization**: Translate song titles, core English hooks, and concept keywords into unified, evocative target-language expressions aligned with track lore. Never leave foreign hooks untranslated simply because they are in English.
4. **Diction Guardrails**:
   - *Eliminate AI Pompous Clichés*: Forbid hollow tropes ("浩瀚苍穹", "涅槃之火", "宿命羁绊", "浴火重生"). Ground imagery in original physical lyrics (mirrors, neon lights, asphalt, petals).
   - *Eliminate Casual Chat*: Forbid lazy prose ("我好难过", "再喝一杯酒吧", "赶紧结束这一切"). Maintain stage tension and punchy delivery.
5. **Chants vs. Fillers**:
   - *Rhythmic Chants / Vocables / Onomatopoeia*: Artistically translate by meaning (意译) using sensory verbs and balanced four-character phrasing to preserve stage punch.
   - *Pure Acoustic Fillers*: Omit non-semantic breath releases, sighs, and phrase-end groove syllables to keep subtitles poetic and readable.
6. **Syllable Segmentation & Spacing (`--segment`)**:
   - Multi-character non-Latin words are proportionally subdivided across syllables (`dur / N`).
   - Trailing spaces attach strictly to word boundary syllables to preserve natural word spacing.
   - Timed transliteration spans `<span begin="..." end="...">` in `<iTunesMetadata><transliterations>` populate syllable karaoke boxes without generating static 3rd subtitle lines.

---

## 4. Architectural & Structural Invariants

| Feature | Standard Rule | Technical Implementation |
| :--- | :--- | :--- |
| **Duet Prevention** | Prevent AMLL split-screen duet layout (`isDuet: true`) | Declare **all** agents with `type="group"` in `<metadata>`. Compound singers (`v1 v2`) are synthesized and registered automatically. |
| **Songwriters Presence** | Apple Music specification requires lyricist and composer credits | `<iTunesMetadata><songwriters><songwriter>` must contain valid, deduplicated names. Validator warns if missing, empty, or duplicated. |
| **Unique Keys** | Avoid mapping collisions in playback engines | Every line `itunes:key` (`L1`, `L2`...), agent `xml:id`, and AMLL metadata key must be strictly unique. |
| **Song Parts** | Organize lines into structural musical sections | Continuous `<div itunes:songPart="..." begin="..." end="...">`. First line begin and last line end define div bounds. |
| **Option C Transliteration** | Transliterate non-Latin characters only | Pure Latin lines are **strictly omitted** (`null`). Mixed lines strip Latin words, transliterating only Korean, Japanese, or Chinese characters. |
| **Syllable Karaoke Sync** | Word-by-word Romaja/Pinyin without static 3rd line clutter | Timed spans in `<iTunesMetadata><transliterations>` populate AMLL `word.romanWord`. Suppress inline `<span ttm:role="x-roman">` on `<p>`. |
| **Dual-Track Translation** | Simultaneous support for AMLL & Apple Music | **Track A**: Inline `<span ttm:role="x-translation">` on every `<p>`.<br>**Track B**: Centralized `<iTunesMetadata><translations><translation><text for="L{N}">` covering 100% of lines. |
| **Background Vocals** | Ad-libs, chants, and secondary vocals | Nest inside `<span ttm:role="x-bg">`. Background translations and transliterations must be nested strictly inside `x-bg`. |
| **Clean Formatting** | Git-diffable, canonical TTML output | 2-space indentation, inline leaf tags, and preserved syllable whitespace. |

---

## 5. CLI Reference

```bash
# Export raw TTML into workspace JSON
bun scripts/ttml_pipeline.ts export <input.ttml> [-o <workspace.json>]

# Search Genius for song parts, vocalists, and TTML skeleton
bun scripts/fetch_genius_parts.ts "<artist> <title>" [--ttml] [--lyrics]

# Fetch metadata (title, artists, album, songwriters, platform IDs) from QQ Music and NetEase
bun scripts/fetch_song_meta.ts "<artist> <title> | song url" [--source qq|netease|all] [--apply workspace.json] [--force] [--json]

# Build completed TTML from workspace JSON (add --segment for syllable-level CJK segmentation)
bun scripts/ttml_pipeline.ts build <input.ttml> <workspace.json> -o <output.ttml> [--no-roman] [--segment]

# Validate TTML syntax, AMLL duet status, metadata completeness, songwriters, duplicates, and Option C
bun scripts/validate_ttml.ts <file.ttml>

# Test suite and linting
bun test
bun run check
```

---

## 6. References & Specifications

- **Specification**: [references/ttml_spec.md](references/ttml_spec.md) (Full schema, metadata, and namespaces)
- **Translation Criteria**: [references/translation_and_style.md](references/translation_and_style.md) (Literary criteria and timing guardrails)
- **Duet Mechanics**: [references/agents_and_duet.md](references/agents_and_duet.md) (AMLL duet state machine and agent rules)
