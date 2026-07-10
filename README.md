# AI ToolOps Manager

AI ToolOps Manager（AI 工具装备管理器）是一个本地优先的 AI 开发工具治理 MVP。

它把 MCP、skill、prompt、Agent 规则、代码图谱、语义搜索、构建验证等工具抽象成"能力槽位"，再用装备系统管理当前项目实际启用的工具。

---

## 快速开始

### 推荐：一步本地安装并同步项目

解压新版工具包后，在工具目录执行：

```bash
npm run install:local --project /path/to/your-project
```

这一步会自动执行：

```text
npm link
ai-toolops setup --project /path/to/your-project
```

如果同步完成后直接打开 UI：

```bash
npm run install:local --project /path/to/your-project --ui
```

### 已经 npm link 后：一步同步当前项目

进入业务项目根目录执行：

```bash
ai-toolops setup
```

等价于自动完成初始化 / 升级、Doctor、规则同步和 UI 数据生成。然后运行：

```bash
ai-toolops ui
```

也可以从任意目录指定项目（`--project` 是全局参数）：

```bash
ai-toolops setup --project /path/to/your-project
ai-toolops ui --project /path/to/your-project
```

### 在其他项目中复用

全局安装或 `npm link` 只需要完成一次。之后每个业务项目首次接入时运行：

```bash
ai-toolops setup --project /path/to/another-project
ai-toolops ui --project /path/to/another-project
```

`setup` 会针对目标项目重新扫描并生成独立的 `.ai-toolops/`。它不会把上一个项目的装备顺序、启停状态和使用次数直接复制到新项目。

| 能力 | 新项目中的行为 | 是否需要 AI |
|------|----------------|------------|
| 项目画像与装备扫描 | 重新识别目标项目的框架、脚本、规则文件、命令和 MCP 配置 | 否 |
| Tool / Plugin 扫描 | 扫描 ToolOps 自带 manifest 与目标项目的 `plugins/`，并在目标环境验证可用性 | 否 |
| Skill 扫描 | 扫描目标项目 Skill、用户级 Skill 和已安装插件缓存 | 否 |
| Skill 中文概览、场景分类、标签 | 根据名称和描述在本地确定性生成，不调用大模型、不联网 | 否 |
| Skill 启停状态 | 写入目标项目 `.ai-toolops/skills.json`，项目之间相互独立 | 否 |
| 使用次数、最近使用时间 | 每个项目独立统计；新项目默认从 0 开始，不做跨项目汇总 | 部分需要 |
| Agent 按装备策略选工具 | Agent 必须读取 ToolOps 规则入口，并遵守启停、可用性和优先级 | 是 |

使用次数有两种上报方式：

- 在 Skill 页面点击“记一次使用”，不依赖 AI。
- Agent 实际使用 Skill 后执行 `ai-toolops skill use <name>`；这要求 Agent 已读取生成规则并拥有执行该命令的权限。

当前正式适配器是 Codex、Claude Code 和 Roo Code。其他 Agent 如果能够读取项目文件并执行本地工具，可先在其外层规则中配置这一句话：

> 开始任务前先读取项目根目录 `AGENTS.md`，并按其中 AI ToolOps 入口按需读取 `.ai-toolops/generated/AGENTS.toolops.md` 与 `.ai-toolops/effective-policy.md`；只使用已启用且 Doctor 判定可用的工具。

这能接入通用规则，但不会自动赋予宿主原本没有的命令、MCP、浏览器连接器或专属插件能力。Codex 专属 Skill、App 或工具命名空间也不能仅靠规则迁移到其他 Agent。

### 传统方式

```bash
npm link
cd /path/to/your-project
ai-toolops init --yes
ai-toolops doctor
ai-toolops sync-agent-rules
ai-toolops ui
```

---

## 核心功能

- **独立 CLI** – 可安装到任何项目，无需入侵业务代码。
- **`init` 自动扫描** – 扫描已有项目并生成 `.ai-toolops` 配置。
- **能力槽位模型** – Agent 选择能力，不直接绑定工具；一个槽位可装备多个同类工具，排序第一的生效。
- **装备栏 Web UI** – 按 Agent 执行流程展示装备卡片，支持开关启用/禁用、拖拽排序、新增同类工具。
- **多 Agent 适配** – 支持 Codex / Claude Code / Roo Code 适配文档输出和规则生成。
- **Agent 规则生成** – 生成 `.ai-toolops/effective-policy.md`、`.ai-toolops/generated/AGENTS.toolops.md` 和按需加载的细则文件。
- **`sync-agent-rules`** – 将 ToolOps 引用块同步进 `AGENTS.md`。
- **Doctor 健康检查** – 检查命令、项目文件和 Agent MCP 配置，区分已安装、推荐未安装、已配置未安装等状态。
- **Plugin 系统** – 支持 `plugins/tools/`、`plugins/skills/` 目录，可扫描和列出插件。
- **Skill 能力目录** – 自动生成中文概览、使用场景和多标签，支持搜索、筛选、启停与项目级使用统计。
- **Rollback 快照回滚** – 回滚最近的初始化快照。
- **本地优先** – 不默认上传，不默认后台扫描，不默认联网。

---

## 命令参考

### 基础命令

```bash
ai-toolops init --yes                         # 初始化当前项目
ai-toolops scan                               # 扫描并打印项目画像
ai-toolops doctor                             # 检查装备健康状态并生成 UI 数据
ai-toolops ui [--port 4177]                   # 生成并打开装备栏静态服务
ai-toolops setup [--project 路径] [--ui]       # 一步初始化/升级、doctor、同步规则和生成 UI
ai-toolops rollback                           # 回滚最近一次初始化快照
```

### 装备管理命令

```bash
ai-toolops equip <slot> <tool>                # 将工具加入槽位并置顶，第一项生效
ai-toolops unequip <slot>                     # 清空能力槽位
ai-toolops toggle <slot> on|off               # 启用或禁用槽位；关闭后不使用该能力工具
ai-toolops reorder-tools <slot> <tool...>     # 调整同类工具顺序，第一项生效
ai-toolops register-tool <slot> <tool>        # 注册工具到槽位，不直接手改配置
ai-toolops create-slot <slot> --label 名称     # 新增能力槽位，可用参数指定类型/流程阶段/关系组
```

### Agent 规则命令

```bash
ai-toolops generate-agent-rules [--apply]     # 生成 Agent 轻量索引、按需细则与有效策略文件
ai-toolops sync-agent-rules                   # 生成规则并同步 AGENTS.md 引用块
ai-toolops adapters list|enable|disable [id]  # 查看或切换 Agent 适配目标
```

### Plugin / Skill 命令

```bash
ai-toolops plugin scan                        # 扫描 plugins/tools/ 和 plugins/skills/ 目录
ai-toolops plugin list                        # 列出已扫描的插件注册表
ai-toolops skill scan                         # 扫描项目级、用户级和已安装插件 Skill
ai-toolops skill list                         # 列出所有 Skill 及启用状态
ai-toolops skill enable|disable <name>        # 持久化启用或禁用 Skill，并刷新 Agent 策略/UI
ai-toolops skill use <name>                   # 记录一次实际使用，更新项目级次数和最近使用时间
```

### 使用示例

```bash
ai-toolops register-tool code_graph codebase-memory-mcp --label "Codebase Memory MCP"
ai-toolops equip code_graph codebase-memory-mcp
ai-toolops reorder-tools code_graph codebase-memory-mcp
ai-toolops toggle code_graph on
ai-toolops doctor
```

---

## Plugin 系统

ToolOps 支持可插拔的工具和 Skill 扩展。插件存放在 `plugins/` 目录下：

```text
plugins/
  tools/
    my-tool/
      manifest.json      # 工具检测与能力声明
  skills/
    my-skill/
      manifest.json      # 可选的 ToolOps 元信息覆盖
```

Skill 自动扫描同时识别：

- 项目 `.codex/skills/`、`.claude/skills/`、`.roo/skills/`、`.agents/skills/` 下的标准 `SKILL.md`。
- 用户目录中的上述 Skill 位置。
- Codex 已安装插件缓存中的 `skills/*/SKILL.md`。
- AI ToolOps 自带 `plugins/skills/*/manifest.json`。

扫描结果写入 `.ai-toolops/plugin-registry.json`，启停选择写入 `.ai-toolops/skills.json`。`setup`、`doctor`、`ui` 和配置变更会同步刷新扫描结果、Doctor、有效策略、Adapter 与 UI；扫描只读取本地元数据，不上传 Skill 内容，也不启动后台扫描。

扫描完成后，ToolOps 会根据 Skill 名称和描述在本地生成：

- 简体中文能力概览，并保留英文原文切换。
- 使用场景分类，例如设计与视觉、文档与办公、代码与工程、GitHub 与协作。
- 多个能力标签，用于页面搜索和交集筛选。
- 当前项目的使用次数与最近使用时间。

分类、标签和中文概览属于本地确定性整理，不要求 AI 参与。使用频率保存在当前项目的 `.ai-toolops/skills.json`；ToolOps 不读取 Agent 历史对话来猜测使用次数，必须由页面按钮或 `ai-toolops skill use <name>` 明确上报。

---

## UI 装备栏说明

装备栏 Web UI 在浏览器中运行，提供完整的装备管理体验：

### 布局与主题

- 顶部支持**白天/夜晚模式**切换，浏览器本地记忆选择。
- 装备区可选择每行 **1 / 2 / 3 张卡片**，浏览器记忆本地选择。
- Doctor 区域**默认折叠**，只显示摘要；展开后用统一行布局展示检查项，颜色区分 `info`、`warning`、`error`。

### 装备卡片

- 按 Agent 通用流程展示：**规则入口 → 项目上下文 → 项目检索 → 验证 → 反馈**。
- 相似或互补能力放入同一流程阶段（如 `exact_search`、`semantic_search`、`code_graph` 同属"项目检索"）。
- 同一张卡片可展示**多个已安装同类工具**，支持拖拽或上下按钮排序，排序第一的为当前生效工具；保存后只局部更新装备区，不整页刷新。
- 卡片右上角 **switch 开关**控制槽位启用/禁用；关闭后 Agent 不使用该能力槽位的任何工具。
- 已禁用 / 推荐未安装的工具以 warning 卡片展示，避免误认为可用。
- 卡片底部**加号**用于生成同类工具安装接入提示词（不直接安装工具）。
- "已安装装备"标题旁的**全局加号**用于生成通用新增工具提示词：AI 会先判断是否已安装 → 安装或接入 → 自动归类/新增槽位。

### 状态颜色

| 状态 | 说明 |
|------|------|
| `installed` | 已检测到真实命令或项目内配置 |
| `recommended_not_installed` | 已作为推荐装备写入配置，但未检测到真实安装 |
| `configured_not_installed` | 已配置，但缺少必要文件或命令 |
| `configured_unverified` | 已配置，但当前版本还不能自动验证 |

---

## Agent 规则集成

推荐把 `AGENTS.md` 作为轻量入口，具体规则交给 ToolOps 生成文件按需维护。

```bash
ai-toolops generate-agent-rules --apply
# 或
ai-toolops sync-agent-rules
```

执行后生成：

```text
.ai-toolops/effective-policy.md
.ai-toolops/generated/AGENTS.toolops.md
.ai-toolops/generated/CODEX.toolops.md
.ai-toolops/generated/CLAUDE.toolops.md
.ai-toolops/generated/ROO.toolops.md
AGENTS.md 里的 AI ToolOps 引用块
```

Agent 读取流程：

1. 先读取 `AGENTS.md` 的 ToolOps 引用块
2. 再读取 `.ai-toolops/generated/AGENTS.toolops.md`（规则索引）
3. 需要工具决策时读取 `.ai-toolops/effective-policy.md`
4. 进入具体流程阶段时读取 `.ai-toolops/generated/rules/*.md`

这样既能保持上下文精简，也能避免把禁用或未安装工具当作可用工具。

### AGENTS 模板

工具包内置两个简洁模板：

```text
templates/global-codex-agents.example.md      # 系统/Codex 级通用硬规则
templates/project-agents.example.md           # 项目级路由和 ToolOps 入口
```

用于"两层 AGENTS.md"场景：系统级保留通用硬规则；项目级保留路由和 ToolOps 入口；详细规则按需读取生成文件。

---

## 默认能力槽位

系统预置 7 个能力槽位，覆盖 Agent 开发流程的完整生命周期：

| 槽位 | 标签 | 流程阶段 | 类型 | 默认工具 |
|------|------|---------|------|---------|
| `exact_search` | 精确搜索 | 项目检索 | 外部工具 | `rg` |
| `semantic_search` | 语义搜索 | 项目检索 | 外部工具 | `semble` |
| `code_graph` | 代码图谱 | 项目检索 | 外部工具 | `codebase-memory-mcp` |
| `architecture_context` | 架构上下文 | 项目上下文 | 项目内置 | `project-architecture-docs` |
| `build_validation` | 构建验证 | 验证 | 项目内置 | `package-scripts` |
| `agent_compatibility` | Agent 兼容层 | 规则入口 | 内置适配 | `codex-adapter` |
| `human_confirmation` | 人工确认 | 反馈 | 交互工具 | `askhuman` |

---

## 生成目录结构

```text
.ai-toolops/
  project.profile.json
  project-dna.json
  capabilities.json
  tool-registry.json
  equipment.json
  health-report.json
  effective-policy.md
  adapters.json
  plugin-registry.json
  skills.json
  adapters/
    index.md
    codex.toolops.md
    claude.toolops.md
    roo.toolops.md
  generated/
    AGENTS.toolops.md
    CODEX.toolops.md
    CLAUDE.toolops.md
    ROO.toolops.md
    rules/
      index.md
      project-retrieval.md
      feedback.md
      <workflow-stage>.md
  ui/
  history/
  backups/
```

---

## 设计原则

- 不修改业务代码。
- 不默认修改 package.json。
- 不默认联网。
- 不默认上传。
- 不默认后台扫描。
- 重型工具按需启用。

---

> 查看完整更新历史请访问 [CHANGELOG.md](docs/CHANGELOG.md)。
