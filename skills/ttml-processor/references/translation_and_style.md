# Lyric Translation Standards & Timing Guardrails (Xin Ya Da)

Definitive guidance on translating lyrics for Apple Music and AMLL TTML files with literary quality, musical flow, rhythm-matching phrasing, and strict syllable timing guardrails.

---

## 1. Pre-Translation Context & Lore Alignment

Before translating, conduct thorough contextual research:

1. **Artist & Group Style**: Identity (e.g. Girl Crush, Dark Cyberpunk, Retro Disco, Ballad) and vocalist personas.
2. **Album Concept & Lore**: Thematic narrative, fictional worldviews (e.g., virtual avatars/KWANGYA, resistance lore), and the song's role in the album arc. Metaphors must align with lore nouns and themes.
3. **Musical Flow & Emotional Dynamic**: Genre (Trap, Drill, Dance-Pop, R&B) and tempo/BPM dictating vocal attitude: fierce defiance, chilled confidence, or vulnerability.

---

## 2. Independent Creation & Translation Principles

1. **Strict Zero-Copy Rule**: Prohibit machine translations, web scraps, external lyric sheets, or templated sentences. Craft every translation from scratch based on vocal rhythm and attitude.
2. **Direct Source Translation**: Translate directly from the source language into the target language. Never pivot through English (e.g., Korean/Japanese straight to Chinese). Translate mixed-language lines segment by segment.
3. **Thematic Keyword Localization**: Translate title concepts, core foreign hooks, and narrative keywords into unified, evocative target-language expressions. Never leave foreign hooks untranslated simply because they are in English.
4. **Chants vs. Fillers**:
   - *Rhythmic Chants / Vocables / Onomatopoeia*: Artistically translate by meaning (意译) using sensory action verbs and balanced four-character phrasing to preserve stage momentum and punch.
   - *Pure Acoustic Fillers*: Omit non-semantic breath releases, line-final sighs, and groove ornament syllables to keep subtitles clean, singable, and poetic.

---

## 3. Diction Guardrails: Eliminating AI Tropes & Crude Prose

Strike a precise balance between literary elegance and contemporary musical vernacular:

### A. Eliminate "AI-Generated" Pompous Clichés
- **No empty embellishments**: Forbid hollow tropes like "浩瀚苍穹", "涅槃之火", "绝世容颜", "宿命羁绊", "浴火重生".
- **Grounded imagery**: Anchor translations strictly in concrete lyrics nouns (mirrors, neon lights, asphalt, petals, lightning).

### B. Eliminate Casual Prose Degradation
- **No chatty logs**: Forbid lazy colloquialisms like "我好难过", "再喝一杯酒吧", "赶紧结束这一切".
- **Preserve acoustic bite**: Maintain stage tension, rhythmic weight, and singable cadence.

---

## 4. The Three Pillars of "Xin Ya Da" (信 · 雅 · 达)

### A. Faithfulness (信)
- **Emotional Color**: Reproduce self-actualization, commanding defiance, dark allure, or introspection.
- **Idioms & Slang**: Interpret street slang accurately (*viva la vida mía* -> 活出属于我的人生; *catwalking* -> 步步傲然穿行; *shots* -> 酒杯; *crash out* -> 彻底爆发; *tap out* -> 认输).
- **Vocalist Distinction**: Differentiate contrasting vocalist textures across lines.

### B. Elegance (雅)
- **Visual Phrasing**: Use compact, evocative verbs; eradicate Europeanized grammar ("因为我是那一个").
- **Poetic Imagery**: Condense metaphors (mirrors, waves, flames) into aesthetic phrasing.

### C. Expressiveness & Rhythm (达)
- **Meter & Cadence Alignment**: Syllable counts and breathing pauses must match musical beats and rests. Punchy staccato lines require equally concise translations.
- **Chorus Symmetry**: Repeating hooks and choruses require cohesive syllable balance and acoustic rhymes.

---

## 5. Timing Guardrails & Structural Non-Tampering

1. **Zero Timestamp Tampering**:
   - Never alter syllable `<span begin="..." end="...">` timestamps or sung text.
   - Never alter `<p>` or `<div>` boundary timestamps.
2. **1:1 Dual-Track Coverage**:
   - Every `<p itunes:key="L{N}">` must have exactly one inline `<span ttm:role="x-translation">`.
   - `<iTunesMetadata><translations>` must mirror all `L1..LN` lines 1:1 without omission or duplicate keys.
3. **Word Spacing**:
   - Preserve trailing spaces on word boundaries.
   - When adjacent word spans lack separating whitespace, adjust workspace text spacing so the pipeline attaches boundary spaces automatically.
4. **Syllable Segmentation (`--segment`)**:
   - Subdivide non-Latin words proportionally across characters (`dur / N`).
   - Attach trailing whitespace strictly to word-final syllables.
   - Write timed transliterations into `<iTunesMetadata><transliterations>` without static 3rd line `<span ttm:role="x-roman">` on `<p>`.
