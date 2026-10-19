# Apple Music TTML & AMLL Specification Quick Reference

XML schema, namespaces, and element formatting standards for TTML (`*.ttml`) lyric files compatible with Apple Music and AMLL (Apple Music-like Lyrics).

---

## 1. Document Architecture & Namespaces

```xml
<tt itunes:timing="Word" xml:lang="ko"
    xmlns="http://www.w3.org/ns/ttml"
    xmlns:itunes="http://music.apple.com/lyric-ttml-internal"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:tts="http://www.w3.org/ns/ttml#styling"
    xmlns:amll="http://www.example.com/ns/amll">
  <head>
    <metadata>
      <ttm:title>Song Title</ttm:title>

      <!-- Vocalists: type="group" strictly required to prevent split-screen duet layout -->
      <ttm:agent type="group" xml:id="v1"><ttm:name type="full">Singer 1</ttm:name></ttm:agent>
      <ttm:agent type="group" xml:id="v2"><ttm:name type="full">Singer 2</ttm:name></ttm:agent>
      <ttm:agent type="group" xml:id="v1 v2"><ttm:name type="full">Singer 1, Singer 2</ttm:name></ttm:agent>

      <!-- AMLL Metadata (Unique keys; musicName & artists essential) -->
      <amll:meta key="musicName" value="Song Title"/>
      <amll:meta key="artists" value="Official Release Artist"/>
      <amll:meta key="album" value="Album Name"/>
      <amll:meta key="qqMusicId" value="QQ Music ID (optional)"/>
      <amll:meta key="ncmMusicId" value="NetEase ID (optional)"/>
      <amll:meta key="ttmlAuthorGithub" value="GitHub Username"/>

      <amll:vocals>
        <vocal key="1" value="Singer 1"/>
        <vocal key="2" value="Singer 2"/>
      </amll:vocals>

      <iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
        <!-- Songwriters: mandatory per Apple Music spec; deduplicated case-insensitively -->
        <songwriters>
          <songwriter>Lyricist Name</songwriter>
          <songwriter>Composer Name</songwriter>
        </songwriters>

        <!-- Track B: Centralized Translations (100% 1:1 coverage of L1..LN) -->
        <translations>
          <translation xml:lang="zh-Hans">
            <text for="L1">First line Chinese translation</text>
            <text for="L2">Second line Chinese translation</text>
          </translation>
        </translations>

        <!-- Option C Transliterations: timed spans (--segment) or plain strings -->
        <transliterations>
          <transliteration xml:lang="ko-Latn">
            <text for="L1">
              <span begin="0:10.200" end="0:11.100">kkoch-eul </span>
              <span begin="0:11.100" end="0:12.000">pi-wo </span>
            </text>
            <text for="L2">geu wi-ro</text>
          </transliteration>
        </transliterations>
      </iTunesMetadata>
    </metadata>
  </head>
  <body dur="3:20.150">
    <div begin="0:10.000" end="0:25.000" itunes:songPart="Verse">
      <p begin="0:10.200" end="0:12.000" itunes:key="L1" ttm:agent="v1">
        <span begin="0:10.200" end="0:11.100">꽃을 </span>
        <span begin="0:11.100" end="0:12.000">피워 </span>
        <span ttm:role="x-translation" xml:lang="zh-Hans">繁花盛放</span>
      </p>
      <p begin="0:20.000" end="0:25.000" itunes:key="L2" ttm:agent="v1">
        <span begin="0:20.000" end="0:22.000">Shine </span>
        <span ttm:role="x-translation" xml:lang="zh-Hans">闪耀</span>
        <!-- Background Vocals: strictly isolate translations/transliterations inside x-bg -->
        <span ttm:role="x-bg" begin="0:22.100" end="0:24.000">
          <span begin="0:22.100" end="0:24.000">(일라)</span>
          <span ttm:role="x-translation" xml:lang="zh-Hans">(苏醒)</span>
          <span ttm:role="x-roman">(il-ra)</span>
        </span>
      </p>
    </div>
  </body>
</tt>
```

---

## 2. Invariants & Element Standards

| Element / Attribute | Structural Rules & Invariants |
| :--- | :--- |
| **`ttm:agent`** | Declare all agents with `type="group"` (`isDuet: false`). Compound singers (`v1 v2`) must have matching declarations. |
| **`songwriters`** | Mandatory under `<iTunesMetadata>`. Must contain at least one valid lyricist/composer. Unique names. |
| **`itunes:songPart`** | Continuous `<div>` sections (`Intro`, `Verse`, `Pre-Chorus`, `Chorus`, `Post-Chorus`, `Bridge`, `Outro`, `Refrain`). Bounds must align: `div.begin == first(p).begin`, `div.end == last(p).end`. |
| **`itunes:key`** | Unique line identifier (`L1`, `L2`...) across the entire document. |
| **Dual-Track Translation** | **Track A**: Inline `<span ttm:role="x-translation">` on every `<p>`.<br>**Track B**: Centralized `<translations><translation><text for="L{N}">` covering 100% of lines. |
| **`x-bg` Isolation** | Secondary vocals, ad-libs, and sighs nest inside `<span ttm:role="x-bg">`. Background translations and romanizations must stay inside `x-bg`. |
| **Option C Transliteration** | Pure Latin lines omit transliteration (`null`). Mixed lines strip Latin words, romanizing non-Latin characters only. |
