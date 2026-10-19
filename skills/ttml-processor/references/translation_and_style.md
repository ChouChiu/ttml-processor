# Lyric Translation Standards & Timing Guardrails (Xin Ya Da)

Engineering and literary standards for translating Apple Music and AMLL synchronized lyrics with singable cadence, attitude alignment, and structural timing integrity.

---

## 1. Context & Concept Alignment

1. **Vocalist Persona & Style**: Align tone with artist identity (Girl Crush, Dark Cyberpunk, Retro Disco, Ballad, etc.).
2. **Lore & Narrative Metaphors**: Align imagery with album worldview lore and themes.
3. **Musical Flow & BPM Dynamic**: Tempo and genre (Trap, Drill, Dance-Pop, R&B) dictate attitude: fierce defiance, chilled confidence, or vulnerability.

---

## 2. Translation Directives

1. **Zero-Copy Rule**: Forbid machine translations, web scraps, or external lyric sheets. Craft translations from scratch.
2. **Direct Source Translation**: Translate directly from the original language (e.g. Korean/Japanese -> Chinese); never pivot through English.
3. **Thematic Hook Localization**: Translate core concepts and recurring foreign hooks into unified target expressions; never leave hooks untranslated simply because they are in English.
4. **Chants vs. Fillers**:
   - *Rhythmic Chants / Vocables*: Translate artistically by meaning (意译) using sensory verbs and balanced four-character phrasing.
   - *Pure Acoustic Fillers*: Omit non-semantic breath releases and line-end sighs to keep subtitles poetic and readable.

---

## 3. Diction Guardrails

- **Eliminate AI Clichés**: Forbid hollow tropes ("浩瀚苍穹", "涅槃之火", "绝世容颜", "宿命羁绊", "浴火重生"). Ground imagery in concrete lyric nouns (mirrors, neon lights, asphalt, petals, lightning).
- **Eliminate Casual Prose**: Forbid lazy colloquialisms ("我好难过", "再喝一杯酒吧", "赶紧结束这一切"). Maintain stage tension, punchy verbs, and singable cadence.
- **Idioms & Slang**: Interpret street slang in context (*viva la vida mía* -> 活出属于我的人生; *catwalking* -> 步步傲然穿行; *shots* -> 酒杯; *crash out* -> 彻底爆发; *tap out* -> 认输).
- **Meter & Symmetry**: Syllable count and pauses should match musical beats. Repeating choruses require acoustic rhymes and syllable symmetry.

---

## 4. Timing & Structural Guardrails

1. **Zero Timestamp Tampering**: Never alter syllable timestamps or `<p>`/`<div>` boundaries.
2. **1:1 Dual-Track Mirroring**: Every `<p itunes:key="L{N}">` must have an inline `x-translation` span, and `<iTunesMetadata><translations>` must mirror `L1..LN` lines 1:1 with unique keys.
3. **Word Spacing**: Trailing spaces belong strictly on word-boundary syllables.
4. **Syllable Segmentation (`--segment`)**: Subdivide non-Latin words proportionally (`dur / N`). Populate timed transliterations into `<iTunesMetadata><transliterations>` without static 3rd line `<span ttm:role="x-roman">` on `<p>`.
