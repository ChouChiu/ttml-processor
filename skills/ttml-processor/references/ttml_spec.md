# Apple Music TTML & AMLL Specification Quick Reference

This document defines the complete XML schema, namespaces, and element formatting standards for TTML (Timed Text Markup Language) lyric files compatible with Apple Music and AMLL (Apple Music-like Lyrics).

---

## 1. Root Element & Namespace Declarations

The `<tt>` root element must declare the following standard and internal namespaces, along with timing mode and base song language:

```xml
<tt itunes:timing="Word" xml:lang="en"
    xmlns="http://www.w3.org/ns/ttml"
    xmlns:itunes="http://music.apple.com/lyric-ttml-internal"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:tts="http://www.w3.org/ns/ttml#styling"
    xmlns:amll="http://www.example.com/ns/amll">
  <head>
    <metadata>
      <!-- Metadata, Vocalist Agent declarations, Centralized translations -->
    </metadata>
  </head>
  <body dur="3:20.150">
    <!-- Continuous section <div> blocks partitioned by itunes:songPart -->
  </body>
</tt>
```

---

## 2. Header Metadata (`<head><metadata>`)

The metadata block carries track details, singer registrations, and Apple Music native translation and transliteration trees:

```xml
  <head>
    <metadata>
      <!-- Track title and featured artists -->
      <ttm:title>Song Title (feat. Featured Artist)</ttm:title>

      <!-- Vocalist Agent Declarations (Duet Prevention: all set to type="group") -->
      <ttm:agent type="group" xml:id="v1">
        <ttm:name type="full">Singer 1</ttm:name>
      </ttm:agent>
      <ttm:agent type="group" xml:id="v2">
        <ttm:name type="full">Singer 2</ttm:name>
      </ttm:agent>
      <!-- Combination agent for multi-singer unison lines -->
      <ttm:agent type="group" xml:id="v1 v2">
        <ttm:name type="full">Singer 1, Singer 2</ttm:name>
      </ttm:agent>

      <!-- AMLL Extended Metadata -->
      <amll:meta key="musicName" value="Song Title"/>
      <amll:meta key="artists" value="Official Release Artist"/>
      <amll:meta key="album" value="Album Name"/>
      <amll:meta key="qqMusicId" value="QQ Music ID (optional)"/>
      <amll:meta key="ncmMusicId" value="NetEase Cloud Music ID (optional)"/>
      <amll:meta key="ttmlAuthorGithub" value="Lyric Creator GitHub Username"/>

      <!-- AMLL Group Member Roster (Independent of track release artist) -->
      <amll:vocals>
        <vocal key="1" value="Singer 1"/>
        <vocal key="2" value="Singer 2"/>
      </amll:vocals>

      <!-- Apple Music Native Centralized Metadata & Translations -->
      <iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
        <songwriters>
          <songwriter>Songwriter 1</songwriter>
          <songwriter>Songwriter 2</songwriter>
        </songwriters>

        <!-- Track B: Centralized Translation Mirror (Must cover all L1..LN 1:1) -->
        <translations>
          <translation xml:lang="zh-Hans">
            <text for="L1">First line Chinese translation</text>
            <text for="L2">Second line Chinese translation</text>
            <text for="L3">Third line Chinese translation</text>
          </translation>
        </translations>

        <!-- Option C Transliterations:
             - Standard mode: Plain text string
             - Syllable-segmented mode (--segment): Timed spans for AMLL word.romanWord karaoke mapping without 3rd static line clutter -->
        <transliterations>
          <transliteration xml:lang="ko-Latn">
            <!-- Syllable-timed format (preferred for karaoke highlight) -->
            <text for="L1">
              <span begin="0:10.200" end="0:11.100">kkoch-eul </span>
              <span begin="0:11.100" end="0:12.000">pi-wo </span>
            </text>
            <!-- Line-level format -->
            <text for="L2">geu wi-ro</text>
          </transliteration>
        </transliterations>
      </iTunesMetadata>
    </metadata>
  </head>
```

---

## 3. Song Part Structuralization (`itunes:songPart`)

All lyric lines `<p>` **must be physically wrapped inside continuous `<div>` blocks** according to the song's musical arrangement. Never leave lines loose or wrap each line in its own single-line `<div>`:

```xml
  <body dur="3:15.500">
    <div begin="0:12.340" end="0:35.800" itunes:songPart="Verse">
      <p begin="0:12.340" end="0:15.200" itunes:key="L1" ttm:agent="v1">
        <span begin="0:12.340" end="0:13.100">I </span>
        <span begin="0:13.100" end="0:13.800">know </span>
        <span begin="0:13.800" end="0:14.500">my </span>
        <span begin="0:14.500" end="0:15.200">worth</span>
        <!-- Track A: Inline translation span -->
        <span ttm:role="x-translation" xml:lang="zh-Hans">我深知自我价值 万物由我开篇</span>
      </p>
      <!-- Remaining lyric lines for this section -->
    </div>

    <div begin="0:35.800" end="0:48.500" itunes:songPart="Pre-Chorus">
      <!-- ... -->
    </div>

    <div begin="0:48.500" end="1:12.000" itunes:songPart="Chorus">
      <!-- ... -->
    </div>
  </body>
```

### Standard `itunes:songPart` Enumeration
- `Intro`
- `Verse`
- `Pre-Chorus`
- `Chorus`
- `Post-Chorus`
- `Bridge`
- `Outro`
- `Refrain`

### Timing Alignment Rule
- `div` attribute `begin` must equal the `begin` timestamp of its first `<p>` line.
- `div` attribute `end` must equal the `end` timestamp of its last `<p>` line.

---

## 4. Background Vocals & Harmonies (`x-bg`)

Background vocals and ad-libs must be wrapped in `<span ttm:role="x-bg">`. **Their translations and transliterations must be nested inside `x-bg`**, completely isolated from the main vocal line:

```xml
<p begin="0:48.500" end="0:54.200" itunes:key="L15" ttm:agent="v1">
  <!-- Lead vocal syllables -->
  <span begin="0:48.500" end="0:50.100">We flash in the dark</span>
  <!-- Lead vocal translation -->
  <span ttm:role="x-translation" xml:lang="zh-Hans">我们在黑暗中迸发破晓之光</span>

  <!-- Background vocal block -->
  <span ttm:role="x-bg" begin="0:50.150" end="0:51.300">
    <span begin="0:50.150" end="0:51.300">(일라)</span>
    <!-- Background vocal translation -->
    <span ttm:role="x-translation" xml:lang="zh-Hans">(快起身吧)</span>
    <!-- Background vocal transliteration (Option C) -->
    <span ttm:role="x-roman">(il-ra)</span>
  </span>
</p>
```

---

## 5. Option C Transliteration Rules

Apply only when romanization or pinyin is explicitly requested by the user:

| Line Category | Original Sample | Handling Rule | Output Result |
| :--- | :--- | :--- | :--- |
| **Pure English / Latin line** | `Watch how I let it all unfold` | **Completely omit** transliteration elements | *(Skip `<span ttm:role="x-roman">` and centralized `<text>`)* |
| **Pure Non-Latin line** | `안개 처럼 번져가` | Full Romanization | `an-gae cheo-reom beon-jyeo-ga` |
| **Mixed-language line** | `꽃을 피워 내는곳 그 위로 catwalking` | **Strip English words**; romanize only Korean/non-Latin characters | `kkoch-eul pi-wo nae-neun-got geu wi-ro` |
| **Full Latin Loanwords (Spanish/French)** | `Uh, señorita, ah, ah, viva la vida mía` | Omit transliteration | *(Skip transliteration)* |
