# Apple Music TTML & AMLL Specification Quick Reference

XML schema, namespaces, and element formatting standards for TTML (`*.ttml`) lyric files compatible with Apple Music and AMLL (Apple Music-like Lyrics).

---

## 1. Root Element & Namespace Declarations

The `<tt>` root element declares standard TTML and platform extension namespaces:

```xml
<tt itunes:timing="Word" xml:lang="ko"
    xmlns="http://www.w3.org/ns/ttml"
    xmlns:itunes="http://music.apple.com/lyric-ttml-internal"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:tts="http://www.w3.org/ns/ttml#styling"
    xmlns:amll="http://www.example.com/ns/amll">
  <head>
    <metadata>
      <!-- Title, Agents, AMLL Metadata, iTunesMetadata -->
    </metadata>
  </head>
  <body dur="3:20.150">
    <!-- Continuous section <div> blocks partitioned by itunes:songPart -->
  </body>
</tt>
```

---

## 2. Header Metadata (`<head><metadata>`)

Carries track details, singer registrations, songwriters, and centralized translation trees:

```xml
  <head>
    <metadata>
      <!-- Track Title (Mandatory) -->
      <ttm:title>Song Title</ttm:title>

      <!-- Vocalist Agent Declarations (Unique xml:id; type="group" strictly required to prevent duet split) -->
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

      <!-- AMLL Extended Metadata (Unique keys; musicName & artists essential) -->
      <amll:meta key="musicName" value="Song Title"/>
      <amll:meta key="artists" value="Official Release Artist"/>
      <amll:meta key="album" value="Album Name"/>
      <amll:meta key="qqMusicId" value="QQ Music ID (optional)"/>
      <amll:meta key="ncmMusicId" value="NetEase Cloud Music ID (optional)"/>
      <amll:meta key="ttmlAuthorGithub" value="Lyric Creator GitHub Username"/>

      <!-- AMLL Group Member Roster (Unique keys) -->
      <amll:vocals>
        <vocal key="1" value="Singer 1"/>
        <vocal key="2" value="Singer 2"/>
      </amll:vocals>

      <!-- Apple Music Native Metadata & Centralized Trees -->
      <iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
        <!-- Songwriters (Mandatory; lyricist then composer; deduplicated case-insensitively) -->
        <songwriters>
          <songwriter>Lyricist Name</songwriter>
          <songwriter>Composer Name</songwriter>
        </songwriters>

        <!-- Track B: Centralized Translations (1:1 coverage of all lines L1..LN; no duplicate 'for' keys) -->
        <translations>
          <translation xml:lang="zh-Hans">
            <text for="L1">First line Chinese translation</text>
            <text for="L2">Second line Chinese translation</text>
          </translation>
        </translations>

        <!-- Option C Transliterations:
             - Standard mode: Plain text string
             - Syllable-segmented mode (--segment): Timed spans for AMLL word.romanWord sync without 3rd static line clutter -->
        <transliterations>
          <transliteration xml:lang="ko-Latn">
            <!-- Timed syllable format (--segment) -->
            <text for="L1">
              <span begin="0:10.200" end="0:11.100">kkoch-eul </span>
              <span begin="0:11.100" end="0:12.000">pi-wo </span>
            </text>
            <!-- Plain line format -->
            <text for="L2">geu wi-ro</text>
          </transliteration>
        </transliterations>
      </iTunesMetadata>
    </metadata>
  </head>
```

---

## 3. Structural Sections (`itunes:songPart`) & Line Keys

All lyric lines `<p>` must be enclosed in continuous `<div>` blocks partitioned by musical sections:

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
    </div>
  </body>
```

### Invariants:
- **Unique Line Keys**: `itunes:key` (`L1`, `L2`...) must be unique across the document.
- **Section Alignment**: `div` `begin` must equal first `<p>` `begin`; `div` `end` must equal last `<p>` `end`.
- **Standard Parts**: `Intro`, `Verse`, `Pre-Chorus`, `Chorus`, `Post-Chorus`, `Bridge`, `Outro`, `Refrain`.

---

## 4. Background Vocals (`x-bg`)

Ad-libs and secondary vocals must be enclosed inside `<span ttm:role="x-bg">`. Background translations and transliterations must be nested strictly inside `x-bg`:

```xml
<p begin="0:48.500" end="0:54.200" itunes:key="L15" ttm:agent="v1">
  <span begin="0:48.500" end="0:50.100">We flash in the dark</span>
  <span ttm:role="x-translation" xml:lang="zh-Hans">我们在黑暗中迸发破晓之光</span>

  <!-- Background vocal block -->
  <span ttm:role="x-bg" begin="0:50.150" end="0:51.300">
    <span begin="0:50.150" end="0:51.300">(일라)</span>
    <span ttm:role="x-translation" xml:lang="zh-Hans">(快起身吧)</span>
    <span ttm:role="x-roman">(il-ra)</span>
  </span>
</p>
```

---

## 5. Option C Transliteration Rules

| Category | Example Text | Rule | Output |
| :--- | :--- | :--- | :--- |
| **Pure English / Latin line** | `Watch how I let it all unfold` | Omit transliteration completely | *(Omitted from `<text>` and `x-roman`)* |
| **Pure Non-Latin line** | `안개 처럼 번져가` | Full Romanization | `an-gae cheo-reom beon-jyeo-ga` |
| **Mixed-language line** | `꽃을 피워 내는곳 그 위로 catwalking` | Strip Latin words; romanize only non-Latin characters | `kkoch-eul pi-wo nae-neun-got geu wi-ro` |
| **Latin Loanwords (Spanish/French)** | `viva la vida mía` | Omit transliteration | *(Omitted)* |
