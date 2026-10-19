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

Execute this 5-phase procedure when processing TTML lyrics:

```bash
# Phase 1: Structure & Vocalist Discovery (Genius)
bun scripts/fetch_genius_parts.ts "<artist> <title>" --ttml

# Phase 2: Lightweight Export & Metadata Population
bun scripts/ttml_pipeline.ts export song.ttml -o workspace.json
bun scripts/fetch_song_meta.ts "<artist> <title>" --apply workspace.json

# Phase 3: Translation Crafting & Mandatory Agent Audit (Section 3)
# Fill lead ("translation") and ad-lib ("bg_translation") in workspace.json
# Strictly audit metadata accuracy, translation quality, and Option C transliteration rules

# Phase 4: Standardized Build & Romanization
bun scripts/ttml_pipeline.ts build song.ttml workspace.json -o completed.ttml [--no-roman] [--segment]

# Phase 5: Verification & Quality Assurance
bun scripts/validate_ttml.ts completed.ttml
bun test
bun run check
```

*(Note: Run commands from `skills/ttml-processor/`, or prefix paths with `skills/ttml-processor/` when working at the repository root).*

---

## 2. Workspace Schema (`workspace.json`)

Exporting raw TTML to `workspace.json` strips verbose syllable spans, reducing payload size by 70–95% while safeguarding syllable timing from accidental distortion:

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

---

## 3. Mandatory Agent Audit Rules (歌词元数据、翻译与音译三大审查准则)

AI Agents processing or generating TTML lyrics MUST strictly review and verify the following three dimensions before building and finalizing:

### 3.1 歌词元数据审查 (Lyric Metadata Audit)
- **版本对齐与平台 ID**：核实抓取的歌曲音源版本，确保匹配官方录音室发售版本，排除 Live、Remix、伴奏或翻唱版本；核实并保留正确的平台 ID（`qqMusicId`、`ncmMusicId`）。
- **标题与艺术家规范**：`title` 与 `artists` 必须使用官方正式发行署名，去除平台附加的括号标签（如 `(Live)`、`(에스파)` 等）。
- **词曲作者完整性（硬性要求）**：`<songwriters>` 必填且非空。必须包含作词人（Lyricist）与作曲人（Composer），排除编曲（Arranger）与制作人（Producer）。大小写与常见通行拼写统一，严禁留空或捏造。
- **演唱者 Agent 声明**：检查并替换 `workspace.json` 中的临时占位歌手（如 `"v1": "v1"`），关联真实歌手姓名；所有 `<ttm:agent>` 必须声明为 `type="group"`，坚决杜绝触发 AMLL 双列分屏对唱布局。
- **键名与唯一性审查**：严格检查词曲作者、演唱者 Agent ID、行号键名（`L1`, `L2`...）及 AMLL 元数据键名，杜绝重复与冲突。
- **保留手改结果**：严禁在手动修改或核对元数据后再次加 `--force` 重新覆盖 `workspace.json`。

### 3.2 歌词翻译质量审查 (Translation Quality Audit - 信雅达)
- **独立创作与零抄袭**：逐行独立构思，严禁复制机器翻译、网络爬取歌词或外部现成译文。
- **原语言直译**：直接从歌词源语言（韩语、日语等）翻译为目标语言，严禁以英语为中间二道转译。
- **核心意象与外语 Hook 本地化**：深入契合专辑企划概念、世界观 Lore 与曲风态度。歌曲标题意象、核心概念词及反复出现的英文 Hook 必须在译文中落实且风格统一，严禁因原文是英文而整句放弃翻译。
- **措辞去油去套路**：
  - *剔除 AI 虚浮套话*：坚决剔除空洞虚浮的 AI 套路词汇（如“浩瀚苍穹”、“宿命羁绊”、“涅槃之火”、“浴火重生”等），紧扣原词中的具象名词与动作（镜面、霓虹、柏油路、花瓣）；
  - *杜绝口语流水账*：杜绝散漫日常聊天大白话（如“我好难过”、“再喝一杯酒吧”、“赶紧结束这一切”），选用动感具象动词与工整句式，保持舞台张力与歌唱律动。
- **拟声词与语气词区分**：
  - *节拍口号与拟声词*（Vocables/Chants）：带有舞台张力与律动感，须结合曲风做动感意译；
  - *纯无实义尾音*：无语义抒情叹气、短促呼吸声适度省略留白，保持字幕诗意凝练。
- **双轨 1:1 覆盖**：确保行内翻译（Track A: `x-translation`）与集中翻译（Track B: `translations`）逐行 1:1 对应无遗漏。

### 3.3 音译规范审查 (Transliteration Audit - Option C)
- **Option C 严格遵循**：
  - 纯英文/纯拉丁字符行**严禁音译**（必须为 null / 省略）；
  - 混排行必须彻底剔除已有的英文单词，仅对非拉丁字符进行音译，杜绝英文单词被原样拷贝进音译轨。
- **音节切分平滑性（`--segment`）**：
  - 对非拉丁多字词按比例细分为单字音节，检查时间戳单调递增；
  - 尾随空格必须且仅附着在词边界音节末尾，确保卡拉OK逐字高亮时自然分词。
  - 集中音译生成 `<span begin="..." end="...">` 时间轴节点，同时避免在 `<p>` 上生成静态第 3 行音译干扰阅读。
- **和声封闭性**：背景和声（`x-bg`）的翻译与音译必须严格嵌套在 `x-bg` 内部，严禁泄漏至主声部。

---

## 4. Architectural & Structural Invariants

| Feature | Invariant Rule | Technical Implementation |
| :--- | :--- | :--- |
| **Duet Prevention** | Prevent AMLL split-screen duet layout (`isDuet: true`) | Declare **all** agents with `type="group"` in `<metadata>`. Compound singers (`v1 v2`) are synthesized and registered automatically. |
| **Songwriters Presence** | Lyricist and composer credits required | `<iTunesMetadata><songwriters><songwriter>` must contain valid, deduplicated names. |
| **Unique Keys** | Avoid mapping collisions in playback engines | Every line `itunes:key` (`L1`, `L2`...), agent `xml:id`, and AMLL metadata key must be strictly unique. |
| **Song Parts** | Organize lines into structural musical sections | Continuous `<div itunes:songPart="..." begin="..." end="...">`. First line begin and last line end define div bounds. |
| **Option C Transliteration** | Transliterate non-Latin characters only | Pure Latin lines are **strictly omitted** (`null`). Mixed lines strip Latin words, transliterating only Korean, Japanese, or Chinese characters. |
| **Syllable Karaoke Sync** | Word-by-word Romaja/Pinyin without static 3rd line clutter | Timed spans in `<iTunesMetadata><transliterations>` populate AMLL `word.romanWord`. Suppress inline `<span ttm:role="x-roman">` on `<p>`. |
| **Dual-Track Translation** | Simultaneous support for AMLL & Apple Music | **Track A**: Inline `<span ttm:role="x-translation">` on every `<p>`.<br>**Track B**: Centralized `<iTunesMetadata><translations><translation><text for="L{N}">` covering 100% of lines. |
| **Background Vocals** | Ad-libs, chants, and secondary vocals | Nest inside `<span ttm:role="x-bg">`. Background translations and transliterations must be nested strictly inside `x-bg`. |
| **Clean Formatting** | Git-diffable, canonical TTML output | 2-space indentation, inline leaf tags, and preserved syllable whitespace. |

---

## 5. References & Specifications

- **Specification**: [references/ttml_spec.md](references/ttml_spec.md) (Full schema, metadata, and namespaces)
- **Translation Criteria**: [references/translation_and_style.md](references/translation_and_style.md) (Literary criteria and timing guardrails)
- **Duet Mechanics**: [references/agents_and_duet.md](references/agents_and_duet.md) (AMLL duet state machine and agent rules)
