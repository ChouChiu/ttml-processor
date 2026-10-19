# Lyric Translation Standards & Timing Guardrails (Xin Ya Da)

This document provides definitive guidance on translating lyrics for Apple Music and AMLL TTML files with literary quality, musical flow, rhythm-matching phrasing, and strict syllable timing guardrails.

---

## 1. Pre-Translation Research & Lore Alignment

Before translating, **you MUST conduct thorough context and lore research**, strictly avoiding isolated, literal translation:

1. **Artist & Group Context**:
   - Understand the artist/group's style identity (e.g., Girl Crush, Dark Cyberpunk, Retro Disco, Avant-Garde Pop, Vulnerable Ballad) and individual vocalist characterizations.
2. **Album Concept & Lore Alignment (Universe Lore)**:
   - Study the album's thematic narrative and the current track's role within the tracklist (e.g., introductory breakthrough, climax explosion, vulnerable resolution).
   - Align with any specific narrative universe or worldviews (e.g., virtual avatars/KWANGYA, dystopian resistance, time-loop destiny, superpowers). Specialized nouns and metaphors must reflect this lore accurately.
3. **Musical Flow & Emotional Dynamic**:
   - Analyze musical genre (Dance-Pop, Drill, Hyperpop, Trap, R&B) and tempo/BPM to determine the vocal attitude: fierce defiance, chilled confidence, or quiet vulnerability.

---

## 2. Independent Artistic Re-creation (Strict Zero-Copy Rule)

1. **Prohibition of Mechanical Borrowing**:
   - Strictly prohibit copying machine translations, web scraps, or translations from other lyric files.
   - Strictly prohibit recycling templated sentences from similar songs or identical titles.
2. **From-Scratch Crafting**:
   - Every lyric translation is an independent piece of art. Translate from zero based on original vocal cues, rhythm, and stage persona.
   - When requested to re-translate, wipe all assumptions from prior drafts and start afresh line by line.
3. **Direct Source Translation (No Pivot Language)**:
   - Translate directly from the original lyric language into the target language
   - Never translate into English first and then into the target language; a pivot step flattens wordplay, honorifics, and sentence-final nuance that only exist in the source
   - Mixed-language lines (e.g., Korean with English hooks) are translated segment by segment from each segment's own language
4. **Onomatopoeia & Interjections Stay Untranslated**:
   - Keep onomatopoeia, interjections, and vocables in their original form inside the translation (e.g., `oh`, `yeah`, `ah`, `uh`, `na na na`, `la la la`, `woo`, `ooh`, `hey`, `아`, `오`, `ねえ`, `あぁ`)
   - Do not render them as Chinese equivalents such as "哦", "耶", "啊", "啦啦啦", "嘿"
   - A line made up entirely of such sounds uses the original text verbatim as its translation (and as its `bg_translation` for background vocals)
   - Words that carry real meaning beyond sound (e.g., `hey you`, `oh my god` used as a phrase) are translated normally

---

## 3. Diction Guardrails: Avoiding AI Slang & Vulgar Colloquialisms

Lyric translations must strike a precise balance between **literary elegance** and **contemporary musical vernacular**, avoiding two extreme pitfalls:

### A. Eliminate "AI-Generated" Pompous Clichés (Avoid Artificial AI Slang)
- **No empty embellishments**: Never force obscure idioms or pompous tropes for a false sense of "elegance" (e.g., avoid shoehorning generic phrases like "vast cosmos", "flames of nirvana", "peerless beauty", "entangled destiny", "wings of rebirth").
- **Prevent metaphor drift**: The translation must map directly to the concrete nouns, verbs, and visual metaphors of the original lyrics. Do not invent ungrounded epic narratives.

### B. Eliminate Chatty/Crude Colloquialisms (Avoid Prose Degradation)
- **No loose conversational prose**: Never degrade stage-ready lyric lines into everyday chat logs (e.g., avoid lazy phrasings like "I feel so bad", "Just want another cup of booze", "Hurry up and finish this").
- **Preserve stage & acoustic tension**: Lyrics exist to be sung, heard, and performed. Diction must be punchy, compact, rhythmically weighted, and stage-ready.

### C. The Golden Standard: Sharp, Punchy, and Character-Aligned
- Use verbs with dynamic motion and compact 4-character or balanced phrases where appropriate;
- Ensure phrasing feels natural and spoken in the singer's character, without sounding either artificially baroque or lazily vulgar.

---

## 4. The Three Pillars of "Xin Ya Da" (信 · 雅 · 达)

### A. Faithfulness (信 · Faithfulness to Mood & Character)
- **Capture Emotional Color**: Faithfully reproduce the emotional atmosphere (e.g., self-actualization, commanding confidence, dark allure, ecstasy, introspection).
- **Multilingual Idioms & Slang**:
  - Accurately interpret foreign loanwords and street slang:
    - Example: *viva la vida mía* (Spanish) should be translated as celebrating one's own authentic life ("活出属于我的人生 / 尽享此生绚烂"), not a clumsy literal translation.
    - Example: *catwalking* translates to confident strutting ("猫步走秀 / 傲然穿行"), evoking runway poise.
    - Example: *shots* refers to drinks/liquor glasses, not gunfire.
    - Example: *crash out* translates to exploding/unleashing, *tap out* to admitting defeat.
- **Vocalist Personality Distinction**:
  - In multi-vocalist groups or duets, reflect the contrasting vocal personalities (e.g., one sharp/cutting, one airy/melodic).

### B. Elegance (雅 · Literary Texture & Eliminating Translationese)
- **Evocative Visual Phrasing**:
  - Employ compact, rhythmic verbs and evocative Chinese phrasing.
  - Eradicate Europeanized syntactic structures (e.g., avoid "因为我是那一个", "看着我如何展开它").
- **Metaphorical Condensation**:
  - Transform metaphors (mirrors, waves, petals, flames) into poetic, punchy imagery suited to Chinese aesthetics.

### C. Expressiveness & Rhythm (达 · Meter, Breathing & Flow)
- **Meter & Flow Alignment**:
  - The syllable count and cadence of the translated line must match the rhythmic beats (Beat) and breathing pauses (Rest) of the original vocal melody.
  - If the original line is staccato and punchy, the translation must be equally concise; never drag out a short line into a lengthy sentence.
- **Hook & Chorus Symmetry**:
  - In choruses and repeating hooks, maintain balanced syllable counts and cohesive acoustic rhyme schemes.
  - In repeated choruses that evolve emotionally, subtly escalate the translation's intensity.

---

## 5. Timing Guardrails (Strict Non-Tampering Rule)

When authoring or modifying TTML files, observe these strict guardrails to prevent timing regressions:

1. **Zero Syllable Timestamp Tampering**:
   - **Never alter** `<span begin="..." end="...">` timestamps or original syllable text.
   - **Never alter** the `begin` and `end` times of `<p>` or `<div>`.
2. **Strict 1:1 Line Alignment**:
   - Every `<p itunes:key="L{N}">` must have exactly one inline `<span ttm:role="x-translation">`.
   - The `<iTunesMetadata><translations>` node must include entries for every `L1` through `LN` without omission.
3. **Preserve Whitespace & Punctuation**:
   - Maintain syllable-spacing trailing spaces (e.g., `I `, `know `) to ensure smooth word-by-word highlight transitions in AMLL and Apple Music.
