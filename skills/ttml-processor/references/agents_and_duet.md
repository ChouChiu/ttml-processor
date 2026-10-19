# Vocalist Attribution, Duet Prevention Mechanics & AMLL Metadata Guide

Technical reference for declaring vocalists in Apple Music TTML and AMLL, preventing multi-column duet screen splitting, and organizing group rosters.

---

## 1. Duet State Machine & Split Prevention (`type="group"`)

### Engine Mechanism
Playback engines calculate duet layout dynamically from `<ttm:agent>` attributes:
- Agents declared as `type="person"` or `type="other"` trigger **Duet Mode (`isDuet: true`)**, forcing cramped multi-column split layouts.
- Declaring **all** agents as `type="group"` guarantees single-column scrolling (`isDuet: false`) while fully retaining per-line singer names and avatars.

```xml
<!-- Guaranteed single-column layout (isDuet = false) -->
<ttm:agent type="group" xml:id="v1"><ttm:name type="full">Winter</ttm:name></ttm:agent>
<ttm:agent type="group" xml:id="v2"><ttm:name type="full">Karina</ttm:name></ttm:agent>
<!-- Ensemble / Unison -->
<ttm:agent type="group" xml:id="v1000"><ttm:name type="full">aespa</ttm:name></ttm:agent>
<!-- Compound unison agents (synthesized automatically by build pipeline) -->
<ttm:agent type="group" xml:id="v1 v2"><ttm:name type="full">Winter, Karina</ttm:name></ttm:agent>
```

---

## 2. AMLL Metadata Separation (`artists` vs `vocals`)

Strictly separate the release artist credit from individual group members:

1. **Official Release Artist (`<amll:meta key="artists">`)**:
   - Official release title (e.g., `aespa` or `Taylor Swift`). Do not concatenate individual members unless officially credited that way.
2. **Individual Member Roster (`<amll:vocals>`)**:
   - Declare individual singers with unique sequential keys:
   ```xml
   <amll:vocals>
     <vocal key="1" value="Winter"/>
     <vocal key="2" value="Karina"/>
   </amll:vocals>
   ```
   - Body lines `<p>` may optionally specify `amll:vocal="1"`.

---

## 3. Client Engine Notes

- **Playback Clients (Mobile, Desktop, Web)**: Parse `ttm:agent` attributes directly on `<p>` and map to `<ttm:agent>`. All `type="group"` declarations ensure smooth scrolling with avatars and singer names.
- **Desktop Editor (amll-ttml-tool)**: "Import from artists" reads `<amll:meta key="artists">` only. Manual agent mapping uses `<ttm:agent>`.
