# Vocalist Attribution, Duet Prevention Mechanics & AMLL Metadata Guide

This document explains how to properly declare vocalists in Apple Music TTML and AMLL, prevent unintended split-screen duet layouts, and handle AMLL-specific metadata and editor quirks.

---

## 1. Duet State Machine & Split Prevention (`type="group"` Invariant)

### The AMLL Duet Mechanism
AMLL and TTML parsers calculate the visual layout based on the `type` attribute of `<ttm:agent>` declarations in `<head><metadata>`:
- When lines alternate between agents declared as `type="person"` or `type="other"`, the parser automatically activates **Duet Mode (`isDuet: true`)**, splitting the playback screen into side-by-side or stacked multi-column columns.
- For solo tracks, group ensemble tracks (bands, idol groups), or whenever a uniform single-column scrolling view is desired, this split screen creates distorted, overly compressed text layouts.

### The Solution: Declare All Agents as `type="group"`
To **retain per-line singer names and avatars while strictly preventing split-screen duets**, set `type="group"` on **all** agent declarations in `<head><metadata>`:

```xml
<!-- Individual members declared as type="group" to keep single-column scrolling (isDuet = false) -->
<ttm:agent type="group" xml:id="v1">
  <ttm:name type="full">Winter</ttm:name>
</ttm:agent>
<ttm:agent type="group" xml:id="v2">
  <ttm:name type="full">Karina</ttm:name>
</ttm:agent>
<ttm:agent type="group" xml:id="v3">
  <ttm:name type="full">Ningning</ttm:name>
</ttm:agent>
<ttm:agent type="group" xml:id="v4">
  <ttm:name type="full">Giselle</ttm:name>
</ttm:agent>

<!-- Full ensemble / unison agent -->
<ttm:agent type="group" xml:id="v1000">
  <ttm:name type="full">aespa</ttm:name>
</ttm:agent>
```

### Unison / Multi-Singer Lines (Combination Agents)
When a line is sung simultaneously by multiple vocalists (e.g., `ttm:agent="v1 v2"`):
- **You MUST register that exact combined ID string in `<head><metadata>`**:
```xml
<ttm:agent type="group" xml:id="v1 v2">
  <ttm:name type="full">Winter, Karina</ttm:name>
</ttm:agent>
```
- Only then can body lines safely reference `ttm:agent="v1 v2"`.

---

## 2. AMLL Metadata Separation (`artists` vs `vocals`)

To maintain clean data separation across UI components, strictly differentiate the **track release artist** from the **individual member roster**:

### Official Release Artist (`<amll:meta key="artists">`)
- Contains only the official track artist or group name (e.g., `aespa` or `Taylor Swift`).
- **Never concatenate all member names into this field** unless the official song release artist is explicitly credited that way.

### Member Roster (`<amll:vocals>`)
- Declare individual group members in `<amll:vocals>`:
```xml
<amll:vocals>
  <vocal key="1" value="Winter"/>
  <vocal key="2" value="Karina"/>
  <vocal key="3" value="Ningning"/>
  <vocal key="4" value="Giselle"/>
</amll:vocals>
```
- Lyric lines `<p>` can correspondingly specify `amll:vocal="1"`.

---

## 3. `amll-ttml-tool` Editor Gotchas & Playback Reality

1. **Rust WASM Parser Quirks**:
   - In the desktop `amll-ttml-tool`, the internal Rust WASM parser currently may not populate the editor UI's `vocalTags` directly from `<amll:vocals>`.
   - The editor dialog's "Import from artists" button only reads `<amll:meta key="artists">`.
2. **Playback Engine Truth**:
   - The actual playback engines across AMLL mobile, desktop, and web clients parse `ttm:agent` directly from the TTML lines and match them against `<head><metadata><ttm:agent>`. As long as `<ttm:agent>` is configured properly, singer attribution and avatars render correctly in all players.
