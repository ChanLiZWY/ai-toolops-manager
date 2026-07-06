# AI ToolOps Manager

AI ToolOps Manager（AI 工具装备管理器）是一个本地优先的 AI 开发工具治理 MVP。

它把 MCP、skill、prompt、Agent 规则、代码图谱、语义搜索、构建验证等工具抽象成“能力槽位”，再用装备系统管理当前项目实际启用的工具。

## 特性

- 独立 CLI，可安装到任何项目。
- `init` 自动扫描已有项目并生成 `.ai-toolops` 配置。
- 能力槽位模型：Agent 选择能力，不直接绑定工具。
- 装备栏 Web UI：Doctor 检查统一布局、状态颜色突出，并按 Agent 执行流程展示装备卡片。
- 装备卡片支持开关启用/禁用；关闭后 Agent 不使用该能力槽位的任何工具。
- 一个能力槽位可同时装备多个同类工具，卡片内垂直展示，并可拖拽排序；排序第一的工具生效。
- 装备卡片支持“新增同类工具”：输入工具名或使用 placeholder 推荐名，生成给 AI 的安装接入提示词。
- 已安装装备标题旁提供全局加号，可生成“判断是否已安装 → 安装或接入 → 自动归类/新增槽位”的通用提示词。
- 装备区主区域加宽，并支持每行 1/2/3/4 张卡片切换；相似或互补能力会放在同一流程阶段横向对比。
- 支持 Codex / Claude Code / Roo Code 适配文档输出。
- 支持生成 `.ai-toolops/effective-policy.md`、`.ai-toolops/generated/AGENTS.toolops.md` 和 `.ai-toolops/generated/rules/*.md`，让 Agent 有稳定且按需加载的规则入口。
- 支持 `sync-agent-rules` 将 ToolOps 引用块同步进 `AGENTS.md`。
- Doctor 健康检查。
- Rollback 快照回滚。
- 本地优先，不默认上传，不默认后台扫描。

## v0.1.14 关键调整

本版本聚焦“agent_compatibility 真正封装成适配器层”。

- 新增 `.ai-toolops/adapters.json`，统一管理 Codex / Claude Code / Roo Code 适配目标。
- `agent_compatibility` 不再只是展示卡片，而是驱动规则生成的内部适配层。
- 默认适配器工具拆为 `codex-adapter`、`claude-adapter`、`roo-adapter`，均属于 `internal_adapter`。
- 新增命令：`ai-toolops adapters list|enable|disable <id>`。
- `sync-agent-rules --agent codex|claude|roo|all` 支持按目标刷新适配输出。
- `.ai-toolops/effective-policy.md` 增加 Agent 兼容层说明，明确适配器不是规则源，只是翻译器。
- UI 数据新增 adapters 快照，装备页可展示当前启用 / 关闭的适配目标。
- Doctor 增强对 `agent_compatibility` 的类型检查，避免被误配置成普通工具槽位。

## v0.1.13 关键调整

本版本继续修复 Windows 本地安装脚本。

- 修复 `spawnSync npm.cmd EINVAL`：Windows 下不再直接 `spawn npm.cmd`，改为通过 `cmd.exe /d /s /c "npm link"` 执行。
- 保留 setup 阶段的 shell-free 执行方式，继续避免 `C:\Program Files\nodejs\node.exe` 被拆成 `C:\Program`。
- 支持工具目录、项目目录、Node 安装目录均包含空格的常见 Windows 场景。
- 如果 npm 自身配置存在 `home` 告警，不影响安装流程。

## v0.1.12 关键调整

本版本修复 Windows 路径包含空格时，`npm run install:local` 在第二步执行 `ai-toolops setup` 失败的问题。

- `scripts/install-local.js` 不再通过 shell 拼接命令执行 Node，避免 `C:\Program Files\nodejs\node.exe` 被拆成 `C:\Program`。
- Windows 下 `npm link` 改为直接调用 `npm.cmd`，减少路径转义问题。
- 第二步 setup 直接通过当前 Node 进程执行工具入口，并显式传入 `--project <项目路径>`，支持工具目录和项目目录都包含空格。
- `npm warn Unknown user config "home"` 属于用户 npm 配置告警，不影响 ToolOps 安装流程；本版本不依赖该配置。

## v0.1.11 关键调整

本版本聚焦“UI 阅读体验 + 一步升级/项目同步”。

- UI 顶部新增白天 / 夜晚模式切换，浏览器本地记忆选择。
- Doctor 检查结果默认折叠，只显示错误、警告、提示和检查项数量，排查时再展开明细。
- 调整整体字体、间距、卡片边框、状态颜色和浅色护眼主题，减少信息噪音，突出重点状态。
- 新增 `ai-toolops setup`：在业务项目中一步完成初始化或升级、doctor、Agent 规则同步和 UI 数据生成。
- `ai-toolops setup --project <项目路径>` 支持从任意目录指定业务项目。
- 新增 `scripts/install-local.js` 和 `npm run install:local -- --project <项目路径>`：在解压后的工具目录中一步执行 `npm link` 并对目标项目运行 `ai-toolops setup`。
- 新增 `setup:project` npm script，方便本地调试项目同步流程。

## v0.1.10 关键调整

本版本聚焦“AGENTS.md 简洁入口 + ToolOps 规则按需加载”。

- `AGENTS.md` 同步块从详细规则改为轻量入口，只要求先读 `.ai-toolops/generated/AGENTS.toolops.md`。
- `.ai-toolops/generated/AGENTS.toolops.md` 改为规则索引，不再默认塞入全部 Semble / rg / AskHuman 细则。
- 新增 `.ai-toolops/generated/rules/` 目录：按流程阶段生成细则文件。
- 项目检索规则独立到 `.ai-toolops/generated/rules/project-retrieval.md`。
- AskHuman / 反馈规则独立到 `.ai-toolops/generated/rules/feedback.md`。
- `.ai-toolops/effective-policy.md` 保留完整有效能力矩阵，但只在需要判断启用、禁用、优先级、可用性或 fallback 时读取。
- 适配“全局 AGENTS.md 只写通用硬规则，项目 AGENTS.md 只写路由入口，详细规则按需读取”的使用方式。

## v0.1.9 关键调整

本版本聚焦“按 Agent 执行流程组织装备”。

- 新增 `workflowStage`：能力槽位可以挂到 Agent 流程阶段，例如 `project_retrieval`、`validation`、`feedback`。
- 新增 `relationGroup`：相似或互补能力可以归入同组，例如 `exact_search` 与 `semantic_search` 同属 `file_lookup`。
- UI 从“类型分组”升级为“流程阶段布局”：规则入口 → 项目上下文 → 项目检索 → 验证 → 反馈。
- `exact_search`、`semantic_search`、`code_graph` 会显示在同一“项目检索”阶段，便于按条件选择。
- `effective-policy.md` 和 `AGENTS.toolops.md` 新增文件查找策略：目标明确直接读文件；未知入口/调用链/影响面才用 Semble；Semble 无结果再用 rg 兜底。
- `effective-policy.md` 和 `AGENTS.toolops.md` 新增 AskHuman 使用规则：只在关键确认、风险选择或结束反馈时通过 Shell 调用 `AskHuman.exe`。
- `create-slot` 新增 `--workflow-stage` 和 `--relation-group`，新增槽位可以直接放进流程布局。

## v0.1.8 关键调整

本版本聚焦“让 Agent 遵守 ToolOps 配置”。

- 新增 `ai-toolops generate-agent-rules [--apply]`：生成 Agent 规则与有效策略文件。
- 新增 `ai-toolops sync-agent-rules`：生成规则，并把 ToolOps 引用块同步到项目根目录 `AGENTS.md`。
- 新增 `.ai-toolops/effective-policy.md`：面向 Agent 的有效能力矩阵，直接说明每个槽位是否启用、当前有效工具、是否可用、fallback 和使用规则。
- 新增 `.ai-toolops/generated/AGENTS.toolops.md`：通用 Agent 规则入口。
- 新增 `.ai-toolops/generated/CODEX.toolops.md`、`CLAUDE.toolops.md`、`ROO.toolops.md`：面向不同 Agent 的规则文件。
- `doctor`、`init`、`equip`、`toggle`、`reorder-tools`、`register-tool`、`create-slot` 都会刷新派生规则文件。
- 对推荐未安装或不可用的排序第一工具，`effective-policy.md` 会明确写出“不可用，不得调用”，避免 Agent 误用。

## v0.1.7 关键调整

- Doctor 输出新增 `slots` 摘要矩阵和 `statusCounts`，能直接区分已安装、项目内置、内置适配、推荐未安装、已配置未安装、已关闭。
- UI 分组从三类扩展为五类：外部工具、项目内置能力、Agent 适配、人工确认、推荐未安装 / 不可用。
- `human_confirmation` 在 UI 中独立成“人工确认”，不再被外部工具或 Agent 适配分组稀释。
- 推荐未安装的外部工具独立展示，不再伪装成可用装备，同时保留卡片内安装接入提示词入口。
- `create-slot` 增加 `slotType` 参数校验，避免写入非法槽位类型。
- UI 内切换开关和拖拽排序后，会同步刷新 `.ai-toolops/ui/data.json` 中的 equipment 快照，避免刷新页面后状态回退。
- `npm run check` 扩展检查范围，覆盖 bin、scanner、adapter 等入口。

## v0.1.6 关键调整

- `compatibility-layer` 从旧 `agent_adapter` 拆分到 `agent_compatibility` 槽位，专门负责 Codex / Claude / Roo 等 Agent 规则兼容。
- `AskHuman` 拆分到 `human_confirmation` 槽位，专门负责人机确认，不再与 Agent 兼容层互斥。
- `project-architecture-docs` 与 `package-scripts` 标记为“项目内置能力”，不再伪装成外部已安装工具。
- 新增槽位类型：`exclusive_priority`、`project_context`、`internal_adapter`、`additive`。
- UI 按“外部工具 / 项目内置能力 / Agent 适配”分组展示，避免误解替代关系。
- `ai-toolops doctor` 会自动迁移旧 `agent_adapter` 配置，并更新 registry/capabilities。

## 快速使用

### 推荐：一步本地安装并同步项目

解压新版工具包后，在工具目录执行：

```bash
npm run install:local -- --project /path/to/your-project
```

这一步会自动执行：

```text
npm link
ai-toolops setup --project /path/to/your-project
```

如果同步完成后直接打开 UI：

```bash
npm run install:local -- --project /path/to/your-project --ui
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

也可以从任意目录指定项目：

```bash
ai-toolops setup --project /path/to/your-project
ai-toolops ui --project /path/to/your-project
```

### 传统方式仍可用

```bash
npm link
cd /path/to/your-project
ai-toolops init --yes
ai-toolops doctor
ai-toolops sync-agent-rules
ai-toolops ui
```

## 命令

```bash
ai-toolops init --yes                         # 初始化当前项目
ai-toolops scan                               # 扫描并打印项目画像
ai-toolops doctor                             # 检查装备健康状态并生成 UI 数据
ai-toolops ui [--project 路径] [--port 4177]       # 启动装备栏界面
ai-toolops equip <slot> <tool>                # 将工具加入槽位并置顶，第一项生效
ai-toolops unequip <slot>                     # 清空能力槽位
ai-toolops toggle <slot> on|off               # 启用或禁用槽位；关闭后不使用该能力工具
ai-toolops reorder-tools <slot> <tool...>     # 调整同类工具顺序，第一项生效
ai-toolops register-tool <slot> <tool>        # 注册工具到槽位，不直接手改配置
ai-toolops create-slot <slot> --label 名称       # 新增能力槽位，可用 --slot-type / --workflow-stage / --relation-group 指定布局
ai-toolops generate-agent-rules [--apply]     # 生成 Agent 轻量索引、按需细则与有效策略文件
ai-toolops sync-agent-rules [--agent all|codex|claude|roo] # 生成规则并同步 AGENTS.md 引用块
ai-toolops adapters list|enable|disable [id]   # 查看或切换 Agent 适配目标
ai-toolops setup [--project 路径] [--ui]       # 一步初始化/升级、doctor、同步规则和生成 UI
ai-toolops rollback                           # 回滚最近一次初始化快照
```

示例：

```bash
ai-toolops register-tool code_graph codebase-memory-mcp --label "Codebase Memory MCP"
ai-toolops equip code_graph codebase-memory-mcp
ai-toolops reorder-tools code_graph codebase-memory-mcp
ai-toolops toggle code_graph on
ai-toolops doctor
```

## AGENTS 模板

工具包内置两个简洁模板：

```text
templates/global-codex-agents.example.md
templates/project-agents.example.md
```

它们用于“两层 AGENTS.md”场景：系统 / Codex 级只保留通用硬规则；项目级只保留路由和 ToolOps 入口；详细 ToolOps 规则按需读取生成文件。

## 生成目录

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

## UI 说明

- 顶部支持白天 / 夜晚模式，适合长时间阅读。
- Doctor 区域默认折叠，只显示摘要；展开后用统一行布局展示检查项，并用颜色区分 `info`、`warning`、`error`。
- 装备卡片按 Agent 通用流程展示：规则入口、项目上下文、项目检索、验证、反馈。
- 相似或互补能力会放入同一流程阶段，例如 `exact_search`、`semantic_search`、`code_graph` 同属“项目检索”。
- 项目内置能力显示为“项目内置”，Agent 兼容层显示为“内置适配”，不再当作普通已安装工具。
- 人工确认工具显示在“反馈 / 人工确认”阶段，例如 AskHuman。
- 推荐但未安装或已配置不可用的外部工具会在原流程阶段内以 warning 卡片展示，避免误认为已经可用。
- 同一张卡片可展示多个已安装同类工具，可上下拖拽排序。
- 卡片内排序第一的工具是当前生效工具。
- 卡片右上角 switch 会写入 `.ai-toolops/equipment.json` 的 `enabled` 字段；关闭后该槽位整体禁用。
- 卡片底部加号用于生成同类工具安装接入提示词，不会直接安装工具。
- “已安装装备”标题旁的全局加号用于生成通用新增工具提示词：AI 需要先判断工具是否已安装；已安装则接入合适槽位；未安装则安装后再接入；没有合适槽位时通过 `ai-toolops create-slot` 新增槽位。
- 生成的提示词要求 AI 通过 `ai-toolops create-slot` / `register-tool` / `equip` / `toggle` 命令接入，而不是手动改配置文件。
- 装备区右上角可选择每行 1 / 2 / 3 / 4 张卡片，浏览器会记住本地选择。

## 让 Agent 遵守配置

v0.1.10 以后，推荐把 `AGENTS.md` 作为轻量入口，把具体规则交给 ToolOps 生成文件按需维护。`AGENTS.toolops.md` 只做索引，项目检索、AskHuman、验证等细则放在 `.ai-toolops/generated/rules/*.md`。

```bash
ai-toolops generate-agent-rules --apply
# 或
ai-toolops sync-agent-rules
```

执行后会生成：

```text
.ai-toolops/effective-policy.md
.ai-toolops/generated/AGENTS.toolops.md
.ai-toolops/generated/CODEX.toolops.md
.ai-toolops/generated/CLAUDE.toolops.md
.ai-toolops/generated/ROO.toolops.md
AGENTS.md 里的 AI ToolOps 引用块
```

Agent 应先读取 `AGENTS.md` 的 ToolOps 引用块，再读取 `.ai-toolops/generated/AGENTS.toolops.md`。只有需要工具决策时再读取 `.ai-toolops/effective-policy.md`；只有进入具体流程阶段时才读取 `.ai-toolops/generated/rules/*.md`。这样既能保持上下文精简，也能避免把禁用或未安装工具当作可用工具。

## Doctor 状态说明

`ai-toolops doctor` 会区分：

- `installed`：已检测到真实命令或项目内配置。
- `recommended_not_installed`：已作为推荐装备写入配置，但未检测到真实安装。
- `configured_not_installed`：已配置，但缺少必要文件或命令。
- `configured_unverified`：已配置，但当前版本还不能自动验证。

因此，装备栏里的工具不等于都已经真实安装。Codebase-Memory-MCP、Semble 等外部工具需要单独安装并接入对应 Agent。

## 设计原则

- 不修改业务代码。
- 不默认修改 package.json。
- 不默认联网。
- 不默认上传。
- 不默认后台扫描。
- 重型工具按需启用。
