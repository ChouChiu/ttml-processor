# ttml-processor

面向 Apple Music 与 AMLL（Apple Music-like Lyrics）的逐字同步歌词（TTML）处理工具

支持歌词提取与回写、歌曲元数据抓取、Option C 罗马音音译、双轨翻译生成、AMLL 防分屏处理与格式校验



## 安装

通过 Agent Skills 安装：

```bash
bunx skills add ChouChiu/ttml-processor -y -g
# 或
npx skills add ChouChiu/ttml-processor -y -g
```

如果未安装 `skills` CLI，也可以直接将 [`skills/ttml-processor/SKILL.md`](skills/ttml-processor/SKILL.md) 载入 AI 对话中使用



## 核心特性

- **轻量工作区提取**：将包含毫秒级逐字时间戳的 TTML 提取为纯文本 JSON（体积减少 70%~95%），翻译完成后回写并自动保留原始时间戳，避免上下文超长与时间戳错位
- **AMLL 防分屏（Duet Guard）**：所有演唱者 Agent 默认使用 `type="group"` 声明，防止 AMLL 播放器触发双列对唱分屏布局（`isDuet: true`）
- **复合演唱者声明**：自动识别合唱行中的多歌手标记（如 `agent="v1 v2"`），并在 `<metadata>` 中自动生成对应的复合 Agent
- **Option C 音译支持**：
  - **韩语**：基于韩国国立国语院罗马字标音法（`koroman`）
  - **日语**：基于平文式罗马音（`kuroshiro` + `kuromoji` 词法分析）
  - **中文**：基于汉语拼音（`pinyin-pro`，无声调）
  - **规范遵循**：纯英文行自动跳过；中韩日与英文混排时，仅对非拉丁字符音译
- **双轨翻译生成**：
  - **行内翻译**：在 `<p>` 末尾添加 `<span ttm:role="x-translation">`，适配 AMLL 滚动显示
  - **集中翻译**：在 `<iTunesMetadata><translations>` 下生成按行映射的翻译节点，适配 Apple Music 原生解析
- **曲式分段（songPart）**：自动将歌词行包裹至 `<div itunes:songPart="...">`，首末时间戳与对应行精确对齐
- **背景和声（x-bg）**：支持副歌 Ad-libs 与和声包裹，其翻译与音译均嵌套在 `x-bg` 内部
- **Genius 结构抓取**：免 API Key 获取歌曲曲式分段与演唱者分配，并生成对应的 TTML 骨架
- **歌曲元数据抓取与校验**：从 QQ 音乐与网易云音乐获取标题、艺术家、专辑、作词作曲等信息及平台 ID；校验器严格检查元数据完整性与词曲作者（`<songwriters>`）署名
- **全量去重校验**：对词曲作者、演唱者 Agent ID、行号 Key（`L1`, `L2`...）、AMLL 元数据及集中翻译进行严格去重与唯一性校验，防止键名冲突
- **音节切分与卡拉OK高亮（--segment）**：支持非拉丁语系多字词自动切分为单字音节并按比例划分时间戳，在 `<transliterations>` 下生成时间轴音译 span，无需额外占用静态第 3 行歌词
- **双引擎校验**：结合 `@applemusic-like-lyrics/ttml` 官方解析器与 Cheerio 进行语法、时间戳时序、元数据完整性、词曲作者、去重、和声隔离与 Option C 音译合规检查
- **高保真 XML 格式化**：全自动 2 空格层级美化排版，保护逐字时间戳尾随空格，便于 Git 版本管理与差异对比
- **安全 XML 转义**：全面转义歌词及译文中的 `&`、`<`、`>`、`"` 等特殊字符，杜绝 XML 解析与实体解析异常




## 使用流程

### 1. 导出轻量 JSON
提取原始 TTML 中的歌词文本（体积减少 70%~95%）：

```bash
bun skills/ttml-processor/scripts/ttml_pipeline.ts export song.ttml -o workspace.json
```

### 2. 补全并核对元数据
从 QQ 音乐与网易云抓取标题、艺术家、专辑、作词作曲与平台 ID，写入工作区：

```bash
bun skills/ttml-processor/scripts/fetch_song_meta.ts "歌手名 歌名" --apply workspace.json
```

抓取结果只是草稿，需要逐项核对后直接修改 `workspace.json` 的 `meta`，通过 Skill 使用时 AI 会自动完成这一步并列出改动：
- **匹配版本**：确认选中的不是 Live、Remix、MV 或翻唱版本，必要时用 `--select <n>` 重选或直接传入歌曲链接
- **标题与艺术家**：使用官方发行署名，去掉 `(Live)`、`(에스파)` 等平台附加内容
- **专辑**：平台常返回先行单曲，应改为音源实际所属的专辑，例如 `Armageddon - The 1st Album`
- **作词作曲**：统一为通行署名，合并大小写与拼写差异，不收录编曲与制作人
- **演唱者**：把导出时生成的占位名 `"v1": "v1"` 替换为真实歌手名
- **保留手改**：`--apply` 只填补空字段，手动修改后不要再加 `--force` 重跑

### 3. 填写翻译
在每行的 `translation` 字段填入译文，如包含副歌和声，可在 `bg_translation` 中填入

如需获取官方曲式结构或歌手分词，可使用 Genius 抓取：
```bash
bun skills/ttml-processor/scripts/fetch_genius_parts.ts "歌手名 歌名" --ttml
```

### 4. 构建 TTML
自动生成 Option C 罗马音、曲式 `<div>` 容器并注入双轨翻译与美化排版：

```bash
bun skills/ttml-processor/scripts/ttml_pipeline.ts build song.ttml workspace.json -o completed.ttml [--no-roman] [--segment]
```
*如不需要罗马音，可添加 `--no-roman` 参数；如需对非拉丁语言进行逐字音节切分与卡拉OK高亮对齐，可添加 `--segment` 参数*


### 5. 校验输出与运行测试
检查生成的 TTML 是否符合规范：

```bash
bun skills/ttml-processor/scripts/validate_ttml.ts completed.ttml
```

运行测试、Lint 与类型检查（在 `skills/ttml-processor/` 下执行）：
```bash
bun test
```

```bash
bun run check
```



## 命令行工具

### 1. 流水线脚本 (`ttml_pipeline.ts`)

```bash
# 导出为 JSON 工作区（省略 -o 时输出到 stdout）
bun skills/ttml-processor/scripts/ttml_pipeline.ts export <input.ttml> [-o <workspace.json>]

# 从 JSON 回写生成 TTML
bun skills/ttml-processor/scripts/ttml_pipeline.ts build <input.ttml> <workspace.json> -o <output.ttml> [--no-roman]

# 校验 TTML
bun skills/ttml-processor/scripts/ttml_pipeline.ts validate <file.ttml>
```

### 2. Genius 信息抓取 (`fetch_genius_parts.ts`)

```bash
bun skills/ttml-processor/scripts/fetch_genius_parts.ts "<歌手 歌名 或 Genius URL>" [选项]

# 参数说明：
#   --ttml         输出可直接复制的 <ttm:agent> 声明与 <div> 曲式骨架
#   --lyrics, -l   打印带演唱者归属的完整歌词
#   --select <n>   选择搜索候选结果序号（默认: 1）
#   --json         输出原始 JSON 数据
```

### 3. 歌曲元数据抓取 (`fetch_song_meta.ts`)

```bash
bun skills/ttml-processor/scripts/fetch_song_meta.ts "<歌手 歌名 或 QQ 音乐 / 网易云歌曲链接>" [选项]

# 参数说明：
#   --source <qq|netease|all>   查询的平台（默认: all，QQ 音乐优先，网易云补缺）
#   --select <n>                每个平台选用的搜索候选序号（默认: 1）
#   --apply <workspace.json>    写入工作区，只填补空字段，平台 ID 始终写入
#   --force                     配合 --apply 覆盖已有字段
#   --json                      输出合并后的原始 JSON
```

- 不传 `--source` 时同时查询两个平台，以 QQ 音乐为准，网易云只补缺失字段，两边的平台 ID 都会保留
- 每个平台的前 5 个候选会输出到 stderr，带 `*` 的是本次选中项
- 作词作曲取自平台歌词头部的署名行，「词 / 作词」「曲 / 作曲」会统一为同一角色
- 海外网络下网易云网页搜索接口返回加密结果，因此改用 cloudsearch 接口

### 4. TTML 校验器 (`validate_ttml.ts`)

```bash
bun skills/ttml-processor/scripts/validate_ttml.ts <file.ttml>
```

检查项包括：
- AMLL 解析与分屏判定（`isDuet` 状态）
- XML 语法与基础命名空间（`itunes`, `ttm`, `tts`, `amll`）
- 歌曲元数据完整性（`<ttm:title>`、`musicName`、`artists` 必填）
- 词曲作者（`<songwriters>`）署名与非空校验（Apple Music 规范硬性要求）
- 全量唯一性去重校验（词曲作者、演唱者 Agent ID、行号 Key、AMLL 标签、双轨集中翻译）
- `<div>` 与 `<p>` 时间戳时序（`begin <= end`）与首末对齐
- 演唱者声明与 `type="group"` 校验（杜绝双列分屏）
- 行内翻译（Track A）与集中翻译（Track B）的 1:1 覆盖
- Option C 音译规则（纯英文行跳过、无残留英文单词）
- 背景和声（`x-bg`）翻译与音译的封闭隔离检查




## 项目结构

```text
.
├── README.md
├── .gitignore
└── skills/
    └── ttml-processor/            # Agent Skill 目录
        ├── SKILL.md               # Agent 系统指令与工作流定义
        ├── index.ts               # 统一模块导出入口
        ├── package.json / tsconfig.json / biome.json / bun.lock
        ├── examples/              # 标准范例，同时作为测试的黄金样本
        │   ├── sample_raw.ttml
        │   ├── sample_workspace.json
        │   └── sample_completed.ttml
        ├── references/            # 规范参考文档
        ├── scripts/               # 命令行入口，只负责参数解析、文件读写与输出
        │   ├── ttml_pipeline.ts         # export / build / validate
        │   ├── fetch_genius_parts.ts    # Genius 曲式与歌手抓取
        │   ├── fetch_song_meta.ts       # QQ 音乐 / 网易云元数据抓取
        │   ├── validate_ttml.ts         # 独立校验入口
        │   └── shared.ts                # CLI 公共逻辑
        ├── src/                   # 纯函数核心实现，输入输出均为字符串或对象
        │   ├── lang.ts                  # 文字识别与语言标签
        │   ├── romanizer.ts             # Option C 音译引擎
        │   ├── types.ts                 # 公共类型
        │   ├── ttml/
        │   │   ├── document.ts          # 命名空间、选择器与 DOM 读取工具
        │   │   ├── xml.ts               # 转义与格式化
        │   │   ├── export.ts            # TTML -> 工作区 JSON
        │   │   ├── build.ts             # 工作区 JSON -> TTML
        │   │   └── validate.ts          # 规范校验
        │   ├── genius/
        │   │   ├── client.ts            # 搜索与页面抓取
        │   │   ├── parser.ts            # 歌词页解析与曲式映射
        │   │   └── skeleton.ts          # TTML 骨架生成
        │   └── metadata/
        │       ├── index.ts             # 平台注册、链接识别、合并与写入工作区
        │       ├── qq.ts                # QQ 音乐搜索与详情
        │       ├── netease.ts           # 网易云音乐搜索与详情
        │       ├── credits.ts           # 歌词头部署名解析
        │       └── http.ts
        └── tests/                 # bun test 测试套件
```



## 参考链接

- [AMLL (Apple Music-like Lyrics)](https://github.com/Steve-xmh/applemusic-like-lyrics)
- [AMLL TTML 解析库 (@applemusic-like-lyrics/ttml)](https://github.com/Steve-xmh/applemusic-like-lyrics/tree/main/packages/ttml)
- [W3C TTML 规范](https://www.w3.org/TR/ttml1/)
- [Agent Skills (skills.sh)](https://skills.sh)



## License

[MIT](LICENSE)
