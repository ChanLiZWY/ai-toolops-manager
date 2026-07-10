# CHANGELOG

## v0.2.0

本版本新增 Plugin / Skill 系统，v0.1.x 的更新历史移至 CHANGELOG 独立管理。

- 新增 `plugins/tools/`、`plugins/skills/` 插件目录结构。
- 新增 `ai-toolops plugin scan|list`：扫描或列出插件（tools + skills）。
- 新增 `ai-toolops skill list|enable|disable <name>`：管理 Skill 启停（enable/disable 当前为占位逻辑）。
- 更新 README：历史更新记录移至 `docs/CHANGELOG.md`；READme 聚焦使用方法和功能介绍。
- 版本号升至 0.2.0。

## v0.1.14

本版本聚焦"agent_compatibility 真正封装成适配器层"。

- 新增 `.ai-toolops/adapters.json`，统一管理 Codex / Claude Code / Roo Code 适配目标。
- `agent_compatibility` 不再只是展示卡片，而是驱动规则生成的内部适配层。
- 默认适配器工具拆为 `codex-adapter`、`claude-adapter`、`roo-adapter`，均属于 `internal_adapter`。
- 新增命令：`ai-toolops adapters list|enable|disable <id>`。
- `sync-agent-rules --agent codex|claude|roo|all` 支持按目标刷新适配输出。
- `.ai-toolops/effective-policy.md` 增加 Agent 兼容层说明，明确适配器不是规则源，只是翻译器。
- UI 数据新增 adapters 快照，装备页可展示当前启用 / 关闭的适配目标。
- Doctor 增强对 `agent_compatibility` 的类型检查，避免被误配置成普通工具槽位。

## v0.1.13

本版本继续修复 Windows 本地安装脚本。

- 修复 `spawnSync npm.cmd EINVAL`：Windows 下不再直接 `spawn npm.cmd`，改为通过 `cmd.exe /d /s /c "npm link"` 执行。
- 保留 setup 阶段的 shell-free 执行方式，继续避免 `C:\Program Files\nodejs\node.exe` 被拆成 `C:\Program`。
- 支持工具目录、项目目录、Node 安装目录均包含空格的常见 Windows 场景。
- 如果 npm 自身配置存在 `home` 告警，不影响安装流程。

## v0.1.12

本版本修复 Windows 路径包含空格时，`npm run install:local` 在第二步执行 `ai-toolops setup` 失败的问题。

- `scripts/install-local.js` 不再通过 shell 拼接命令执行 Node，避免 `C:\Program Files\nodejs\node.exe` 被拆成 `C:\Program`。
- Windows 下 `npm link` 改为直接调用 `npm.cmd`，减少路径转义问题。
- 第二步 setup 直接通过当前 Node 进程执行工具入口，并显式传入 `--project <项目路径>`，支持工具目录和项目目录都包含空格。
- `npm warn Unknown user config "home"` 属于用户 npm 配置告警，不影响 ToolOps 安装流程；本版本不依赖该配置。

## v0.1.11

本版本聚焦"UI 阅读体验 + 一步升级/项目同步"。

- UI 顶部新增白天 / 夜晚模式切换，浏览器本地记忆选择。
- Doctor 检查结果默认折叠，只显示错误、警告、提示和检查项数量，排查时再展开明细。
- 调整整体字体、间距、卡片边框、状态颜色和浅色护眼主题，减少信息噪音，突出重点状态。
- 新增 `ai-toolops setup`：在业务项目中一步完成初始化或升级、doctor、Agent 规则同步和 UI 数据生成。
- `ai-toolops setup --project <项目路径>` 支持从任意目录指定业务项目。
- 新增 `scripts/install-local.js` 和 `npm run install:local -- --project <项目路径>`：在解压后的工具目录中一步执行 `npm link` 并对目标项目运行 `ai-toolops setup`。
- 新增 `setup:project` npm script，方便本地调试项目同步流程。

## v0.1.10

本版本聚焦"AGENTS.md 简洁入口 + ToolOps 规则按需加载"。

- `AGENTS.md` 同步块从详细规则改为轻量入口，只要求先读 `.ai-toolops/generated/AGENTS.toolops.md`。
- `.ai-toolops/generated/AGENTS.toolops.md` 改为规则索引，不再默认塞入全部 Semble / rg / AskHuman 细则。
- 新增 `.ai-toolops/generated/rules/` 目录：按流程阶段生成细则文件。
- 项目检索规则独立到 `.ai-toolops/generated/rules/project-retrieval.md`。
- AskHuman / 反馈规则独立到 `.ai-toolops/generated/rules/feedback.md`。
- `.ai-toolops/effective-policy.md` 保留完整有效能力矩阵，但只在需要判断启用、禁用、优先级、可用性或 fallback 时读取。
- 适配"全局 AGENTS.md 只写通用硬规则，项目 AGENTS.md 只写路由入口，详细规则按需读取"的使用方式。

## v0.1.9

本版本聚焦"按 Agent 执行流程组织装备"。

- 新增 `workflowStage`：能力槽位可以挂到 Agent 流程阶段，例如 `project_retrieval`、`validation`、`feedback`。
- 新增 `relationGroup`：相似或互补能力可以归入同组，例如 `exact_search` 与 `semantic_search` 同属 `file_lookup`。
- UI 从"类型分组"升级为"流程阶段布局"：规则入口 → 项目上下文 → 项目检索 → 验证 → 反馈。
- `exact_search`、`semantic_search`、`code_graph` 会显示在同一"项目检索"阶段，便于按条件选择。
- `effective-policy.md` 和 `AGENTS.toolops.md` 新增文件查找策略：目标明确直接读文件；未知入口/调用链/影响面才用 Semble；Semble 无结果再用 rg 兜底。
- `effective-policy.md` 和 `AGENTS.toolops.md` 新增 AskHuman 使用规则：只在关键确认、风险选择或结束反馈时通过 Shell 调用 `AskHuman.exe`。
- `create-slot` 新增 `--workflow-stage` 和 `--relation-group`，新增槽位可以直接放进流程布局。

## v0.1.8

本版本聚焦"让 Agent 遵守 ToolOps 配置"。

- 新增 `ai-toolops generate-agent-rules [--apply]`：生成 Agent 规则与有效策略文件。
- 新增 `ai-toolops sync-agent-rules`：生成规则，并把 ToolOps 引用块同步到项目根目录 `AGENTS.md`。
- 新增 `.ai-toolops/effective-policy.md`：面向 Agent 的有效能力矩阵，直接说明每个槽位是否启用、当前有效工具、是否可用、fallback 和使用规则。
- 新增 `.ai-toolops/generated/AGENTS.toolops.md`：通用 Agent 规则入口。
- 新增 `.ai-toolops/generated/CODEX.toolops.md`、`CLAUDE.toolops.md`、`ROO.toolops.md`：面向不同 Agent 的规则文件。
- `doctor`、`init`、`equip`、`toggle`、`reorder-tools`、`register-tool`、`create-slot` 都会刷新派生规则文件。
- 对推荐未安装或不可用的排序第一工具，`effective-policy.md` 会明确写出"不可用，不得调用"，避免 Agent 误用。

## v0.1.7

- Doctor 输出新增 `slots` 摘要矩阵和 `statusCounts`，能直接区分已安装、项目内置、内置适配、推荐未安装、已配置未安装、已关闭。
- UI 分组从三类扩展为五类：外部工具、项目内置能力、Agent 适配、人工确认、推荐未安装 / 不可用。
- `human_confirmation` 在 UI 中独立成"人工确认"，不再被外部工具或 Agent 适配分组稀释。
- 推荐未安装的外部工具独立展示，不再伪装成可用装备，同时保留卡片内安装接入提示词入口。
- `create-slot` 增加 `slotType` 参数校验，避免写入非法槽位类型。
- UI 内切换开关和拖拽排序后，会同步刷新 `.ai-toolops/ui/data.json` 中的 equipment 快照，避免刷新页面后状态回退。
- `npm run check` 扩展检查范围，覆盖 bin、scanner、adapter 等入口。

## v0.1.6

- `compatibility-layer` 从旧 `agent_adapter` 拆分到 `agent_compatibility` 槽位，专门负责 Codex / Claude / Roo 等 Agent 规则兼容。
- `AskHuman` 拆分到 `human_confirmation` 槽位，专门负责人机确认，不再与 Agent 兼容层互斥。
- `project-architecture-docs` 与 `package-scripts` 标记为"项目内置能力"，不再伪装成外部已安装工具。
- 新增槽位类型：`exclusive_priority`、`project_context`、`internal_adapter`、`additive`。
- UI 按"外部工具 / 项目内置能力 / Agent 适配"分组展示，避免误解替代关系。
- `ai-toolops doctor` 会自动迁移旧 `agent_adapter` 配置，并更新 registry/capabilities。