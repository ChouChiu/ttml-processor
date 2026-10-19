# Vocalist Attribution, Duet Prevention Mechanics & AMLL Metadata Guide

Guidance on declaring vocalists in Apple Music TTML and AMLL, preventing unintended split-screen duet layouts, and managing AMLL-specific metadata.

---

## 1. Duet State Machine & Split Prevention (`type="group"` Invariant)

### AMLL Duet Mechanism
Parsers calculate layout from the `type` attribute on `<ttm:agent>` declarations:
- Lines alternating between agents declared as `type="person"` or `type="other"` activate **Duet Mode (`isDuet: true`)**, splitting the screen into multi-column layouts.
- For solo tracks, band tracks, and group ensemble performances, this split creates cramped, distorted text columns.

### Solution: Declare All Agents as `type="group"`
To **retain per-line singer names and avatars while keeping clean single-column scrolling**, declare **all** agents with `type="group"`:

```xml
<!-- Single-column scrolling guaranteed (isDuet = false) -->
<ttm:agent type="group" xml:id="v1">
  <ttm:name type="full">Winter</ttm:name>
</ttm:agent>
<ttm:agent type="group" xml:id="v2">
  <ttm:name type="full">Karina</ttm:name>
</ttm:agent>

<!-- Full ensemble / unison agent -->
<ttm:agent type="group" xml:id="v1000">
  <ttm:name type="full">aespa</ttm:name>
</ttm:agent>
```

### Unison / Multi-Singer Lines (Compound Agents)
When a line is sung simultaneously by multiple vocalists (e.g., `ttm:agent="v1 v2"`):
- Register the exact compound ID in `<head><metadata>`:
```xml
<ttm:agent type="group" xml:id="v1 v2">
  <ttm:name type="full">Winter, Karina</ttm:name>
</ttm:agent>
```
- Agent IDs (`xml:id`) must be strictly unique. The build pipeline synthesizes and registers compound agents automatically.

---

## 2. AMLL Metadata Separation (`artists` vs `vocals`)

Maintain strict separation between the track release artist and individual member roster:

### Official Release Artist (`<amll:meta key="artists">`)
- Official release artist name (e.g. `aespa` or `Taylor Swift`).
- Do not concatenate all member names into this field unless credited that way on the official release.

### Member Roster (`<amll:vocals>`)
- Declare individual members in `<amll:vocals>` with unique sequential keys:
```xml
<amll:vocals>
  <vocal key="1" value="Winter"/>
  <vocal key="2" value="Karina"/>
</amll:vocals>
```
- Body lines `<p>` may specify `amll:vocal="1"`.

---

## 3. Playback Engine vs. Editor Behavior

1. **amll-ttml-tool Editor**: The desktop editor dialog's "Import from artists" button only parses `<amll:meta key="artists">`.
2. **Playback Engines**: Mobile, desktop, and web AMLL clients parse `ttm:agent` directly from body lines and match against `<ttm:agent>`. As long as all agents are declared with `type="group"`, avatars and names display correctly without screen splitting.
