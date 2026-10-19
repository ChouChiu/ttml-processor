# ttml-processor

面向 Apple Music 与 AMLL（Apple Music-like Lyrics）的逐字同步歌词（TTML）全流程工程化处理工具。

支持歌词工作区提取与回写、歌曲元数据抓取、Option C 音译、音节切分与卡拉OK高亮、双轨翻译生成、AMLL 防分屏处理与格式规范校验。

## 安装与快速上手

### 作为 Agent Skill 安装

```bash
bunx skills add ChouChiu/ttml-processor -y -g
# 或
npx skills add ChouChiu/ttml-processor -y -g
```

未安装 `skills` CLI 时，可直接将 [`skills/ttml-processor/SKILL.md`](skills/ttml-processor/SKILL.md) 载入 AI 编程助手中使用。

### 作为独立仓库使用

```bash
git clone https://github.com/ChouChiu/ttml-lyrics-processor.git
cd ttml-lyrics-processor
bun install
```

## 核心特性

| 领域 | 功能特性 | 说明 |
| :--- | :--- | :--- |
| **工作区架构** | **轻量 JSON 提取与安全回写** | 提取为纯文本 JSON（体积缩减 70%~95%），避免 LLM 上下文超长；回写时 100% 保护毫秒级时间戳 |
| **播放兼容** | **AMLL 防分屏（Duet Guard）** | 演唱者声明默认采用 `type="group"`，彻底杜绝对唱双列分屏，同时完整支持多歌手复合 Agent |
| **音译引擎** | **Option C 规范与音节切分** | 支持韩语（`koroman`）、日语（`kuroshiro`）、中文拼音；`--segment` 支持非拉丁语按比例细切与高亮同步 |
| **双轨翻译** | **行内与集中双轨输出** | 同时生成 AMLL 滚动所需的行内 `x-translation` 与 Apple Music 原生解析的集中 `translations` 节点 |
| **元数据系统** | **平台聚合抓取与严格去重** | 整合 QQ 音乐与网易云元数据及平台 ID；严格校验词曲作者（`<songwriters>`）必填与全量键名唯一性 |
| **结构组织** | **Genius 曲式与和声隔离** | 自动生成 `itunes:songPart` 容器与时间对齐；背景和声（`x-bg`）翻译与音译完全隔离封装 |
| **高保真排版** | **双引擎校验与保真排版** | 结合 AMLL 官方引擎与 Cheerio 语法校验；保护逐字时间戳尾随空格，XML 实体安全转义 |


## 5 步标准工作流程

```bash
# 1. 结构与歌手发现（可选）
bun run genius "歌手名 歌名" --ttml

# 2. 导出轻量工作区
bun run pipeline export song.ttml -o workspace.json

# 3. 补全歌曲元数据
bun run meta "歌手名 歌名" --apply workspace.json

# 4. 回写并构建最终 TTML（支持 --segment 音节切分）
bun run pipeline build song.ttml workspace.json -o completed.ttml

# 5. 格式规范校验与质量检查
bun run validate completed.ttml
bun test
bun run check
```

## 命令行工具速查

### 1. 流水线工具 (`pipeline`)

```bash
# 导出轻量 JSON（缺省 -o 时输出至 stdout）
bun run pipeline export <input.ttml> [-o <workspace.json>]

# 从工作区回写生成符合规范的 TTML
bun run pipeline build <input.ttml> <workspace.json> -o <output.ttml> [--no-roman] [--segment]

# 校验 TTML 文件规范性
bun run pipeline validate <file.ttml>
```

### 2. 歌曲元数据抓取 (`meta`)

```bash
bun run meta "<歌手 歌名 或 歌曲链接>" [选项]

# 核心选项：
#   --source <qq|netease|all>   查询平台（默认: all，QQ 音乐优先，网易云补缺）
#   --select <n>                选用候选序号（默认: 1）
#   --apply <workspace.json>    写入工作区（仅填补空缺字段，平台 ID 始终保留）
#   --force                     强制覆盖已有字段
#   --json                      以 JSON 格式输出结果
```

### 3. 曲式结构与演唱者抓取 (`genius`)

```bash
bun run genius "<歌手 歌名 或 Genius URL>" [选项]

# 核心选项：
#   --ttml         输出可直接复用的 <ttm:agent> 与 <div> 骨架
#   --lyrics, -l   打印带演唱者归属的逐行歌词
#   --select <n>   选用搜索候选序号（默认: 1）
#   --json         输出原始 JSON 结构
```

### 4. 独立规范校验器 (`validate`)

```bash
bun run validate <file.ttml>
```

全量校验项：AMLL 引擎解析与分屏状态、命名空间完整性、元数据及词曲作者（`<songwriters>`）署名、键名全局唯一性、时间戳单调性、双轨翻译 1:1 覆盖、Option C 音译合规性与 `x-bg` 隔离封装。


## 项目结构

```text
.
├── package.json                 # 根工作区配置与便利命令入口
├── README.md                    # 项目说明文档
├── LICENSE                      # MIT 授权协议
└── skills/
    └── ttml-processor/          # Agent Skill 核心包
        ├── SKILL.md             # AI 助手系统工作流定义
        ├── index.ts             # 模块统一导出入口
        ├── package.json         # 依赖与脚本定义
        ├── examples/            # 黄金参考样例（raw / workspace / completed）
        ├── references/          # 权威规范文档（TTML规范、对唱防分屏、翻译准则）
        ├── scripts/             # 命令行入口（shared / pipeline / meta / genius / validate）
        ├── src/                 # 核心逻辑实现
        │   ├── lang.ts          # 语系检测与 BCP 47 语言标签映射
        │   ├── romanizer.ts     # Option C 罗马音转译引擎
        │   ├── types.ts         # 数据结构定义
        │   ├── ttml/            # TTML 文档处理体系
        │   │   ├── build.ts     # TTML 文档构建与组装编排
        │   │   ├── document.ts  # DOM 查询与常量定义
        │   │   ├── export.ts    # 工作区轻量提取
        │   │   ├── segment.ts   # 音节切分、时间戳细分与段落重构
        │   │   ├── time.ts      # 时间戳解析、格式化与倒流检测
        │   │   ├── validate.ts  # 双引擎规范校验
        │   │   └── xml.ts       # XML 转义与排版美化
        │   ├── genius/          # Genius 结构与歌词抓取
        │   └── metadata/        # QQ 音乐与网易云元数据抓取及解析
        └── tests/               # 单元测试与端到端回归测试套件
```


## 参考链接

- [AMLL (Apple Music-like Lyrics)](https://github.com/Steve-xmh/applemusic-like-lyrics)
- [W3C TTML 规范](https://www.w3.org/TR/ttml1/)
- [Agent Skills 规范](https://skills.sh)


## 许可证

[MIT](LICENSE)
