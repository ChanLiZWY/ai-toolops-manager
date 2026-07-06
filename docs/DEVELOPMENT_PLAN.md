# AI ToolOps Manager 开发计划文档 v1.0

## 1. 项目定位

AI ToolOps Manager 是一个独立工具，用于管理 AI 开发过程中的 MCP、skill、prompt、Agent 规则、代码图谱、语义搜索、构建验证、架构检查等能力。

它不是新的 Agent，也不是单一 MCP，而是 Agent 上层的 ToolOps 治理层。

核心理念：

> 不按工具管理，而按能力管理。工具只是能力槽位上的装备。

## 2. 最终方案

最终产品形态：

```text
AI ToolOps Manager =
独立 CLI
+ 可视化装备栏
+ 项目自动扫描
+ 能力槽位系统
+ 工具推荐引擎
+ MCP / skill / prompt / Agent 规则统一管理
+ 一键安装 / 卸载 / 更新 / 迁移
```

长期演进方向：

```text
AI Development OS
├── Capability Registry
├── Tool Registry
├── Workflow Registry
├── Project DNA
├── Developer DNA
├── Team DNA
├── Knowledge Base
├── Router
├── Learning Engine
├── Marketplace
├── Visual Dashboard
└── Auto Migration
```

## 3. 当前第一版目标

第一版只做稳定、可行、低风险能力：

- CLI
- Project Scanner
- Project DNA
- Capability Registry
- Tool Registry
- Equipment Manager
- 规则版 Router
- Compatibility Layer / agent_compatibility Adapter
- Doctor
- Rollback
- 简洁 Web UI 装备栏

不做高风险能力：

- 自动修改业务代码
- 自动提交 Git
- 自动联网同步
- 自动上传代码
- 自动学习并修改规则
- 自动替换工具
- Marketplace
- Cloud Sync

## 4. 当前 MVP 已实现

### 4.1 CLI

命令：

```bash
ai-toolops init --yes
ai-toolops scan
ai-toolops doctor
ai-toolops ui
ai-toolops equip <slot> <tool>
ai-toolops unequip <slot>
ai-toolops rollback
```

### 4.2 Project Scanner

当前支持识别：

- package.json
- packageManager
- pnpm / npm / yarn
- Vue / React / uni-app / Vite / Pinia / TypeScript
- AGENTS.md / CLAUDE.md / Roo / Codex / Cursor 规则文件
- MCP 配置文件
- docs / architecture / ai 目录
- 常见源码目录

### 4.3 Project DNA

生成：

```text
.ai-toolops/project-dna.json
```

包含：

- 项目名称
- 技术栈
- 包管理器
- 目录结构
- Agent 文件
- MCP 文件
- 架构文档
- 本地优先策略

### 4.4 Capability Registry

生成：

```text
.ai-toolops/capabilities.json
```

第一版能力槽位：

- exact_search：精确搜索
- semantic_search：语义搜索
- code_graph：代码图谱
- architecture_context：架构上下文
- build_validation：构建验证
- agent_adapter：Agent 适配

### 4.5 Tool Registry

生成：

```text
.ai-toolops/tool-registry.json
```

第一版内置工具：

- rg
- semble
- codebase-memory-mcp
- project-architecture-docs
- package-scripts
- compatibility-layer

每个工具记录：

- status
- capabilities
- installScope
- localFirst
- cloudUpload
- autoUpdate
- uninstall
- score

### 4.6 Equipment Manager

生成：

```text
.ai-toolops/equipment.json
```

每个能力槽位包含：

- label
- active
- fallback
- loadLevel
- autoLoad
- health

### 4.7 Compatibility Layer

生成：

```text
.ai-toolops/adapters/codex.toolops.md
.ai-toolops/adapters/claude.toolops.md
.ai-toolops/adapters/roo.toolops.md
```

这些文件不是直接覆盖 Agent 配置，而是作为中立规则输出，后续可由 Adapter 写入不同 Agent 的正式配置。

### 4.8 Doctor

生成：

```text
.ai-toolops/health-report.json
```

检查：

- 未知工具
- 重型工具是否自动加载
- 云端上传风险
- 后台扫描风险
- 架构索引缺失
- Agent 规则缺失

### 4.9 Rollback

初始化前会备份：

```text
.ai-toolops/backups/
```

支持：

```bash
ai-toolops rollback
```

### 4.10 装备栏 Web UI

生成：

```text
.ai-toolops/ui/
```

运行：

```bash
ai-toolops ui
```

界面展示：

- 当前项目
- 技术栈
- 健康状态
- 能力槽位
- 当前装备
- fallback
- 加载级别
- 是否自动加载

## 5. 待开发计划

### Milestone 1：工程化完善

目标：让工具具备正式 npm 包质量。

任务：

- 增加 TypeScript。
- 增加单元测试。
- 增加 eslint。
- 增加 prettier。
- 增加 CI。
- 增加 changelog。
- 增加版本迁移机制。
- 增加 Windows / macOS / Linux 路径兼容测试。

验收：

- 所有命令有测试覆盖。
- npm pack 后可安装使用。
- Windows 路径无异常。

### Milestone 2：配置格式升级

目标：支持 JSON + YAML 双格式。

任务：

- 支持 `.ai-toolops/equipment.yaml`。
- 支持 `.ai-toolops/tool-registry.yaml`。
- 支持 schema 校验。
- 支持配置版本迁移。
- 支持手动编辑后的 doctor 校验。

验收：

- 用户可直接编辑 YAML。
- 配置错误时能给出明确提示。

### Milestone 3：更强项目扫描

目标：让 init 能适配更多项目。

任务：

- 支持 monorepo。
- 支持 pnpm workspace。
- 支持 Turborepo / Nx。
- 支持 Python 项目。
- 支持 Go / Rust 项目识别。
- 支持 Figma / Pixso 资源目录识别。
- 支持现有 MCP 配置解析。
- 支持 AGENTS.md / CLAUDE.md 合并建议。

验收：

- 主流前端项目可自动识别。
- monorepo 能识别多个 package。

### Milestone 4：Router 规则引擎

目标：根据任务自动推荐能力槽位。

任务：

- 定义任务类型：页面、模块、架构、测试、文档、Git、原型。
- 根据任务类型推荐能力组合。
- 输出 Agent 可读的 tool plan。
- 支持用户覆盖规则。

示例：

```text
页面任务 -> architecture_context + exact_search + semantic_search + build_validation
架构任务 -> architecture_context + code_graph + exact_search + doctor
```

验收：

- 输入任务描述，能输出推荐能力组合。

### Milestone 5：真实 MCP 安装适配

目标：把 Codebase-Memory-MCP 做成第一个真实可安装装备。

任务：

- 增加 codebase-memory-mcp adapter。
- 支持检测是否已安装。
- 支持生成 Codex / Claude / Roo 的 MCP 配置片段。
- 支持本地索引路径推荐。
- 支持忽略规则生成。
- 支持卸载和禁用。

要求：

- 不自动上传。
- 不自动后台扫描。
- 不默认索引 node_modules / dist / unpackage / legacy / archive / static assets。

验收：

- 在真实项目中一键生成可用 MCP 配置建议。

### Milestone 6：装备栏 UI 升级

目标：从静态展示升级为可操作界面。

任务：

- 支持装备 / 卸下按钮。
- 支持启用 / 禁用按钮。
- 支持查看工具详情。
- 支持查看 Doctor 报告。
- 支持推荐安装列表。
- 支持配置 diff 预览。

验收：

- 用户能通过 UI 完成基础装备管理。

### Milestone 7：Compatibility Layer 完善

目标：真正生成不同 Agent 的配置文件。

任务：

- Codex Adapter。
- Claude Code Adapter。
- Roo Code Adapter。
- Cursor Adapter。
- Windsurf Adapter。
- MCP 配置合并策略。
- 冲突检测。
- 回滚策略。

验收：

- 同一份中立配置可生成多个 Agent 配置。
- 不同 Agent 配置不会互相污染。

### Milestone 8：Developer DNA / Team DNA

目标：减少用户重复写偏好。

任务：

- 支持用户偏好文件。
- 支持团队偏好文件。
- 支持项目覆盖个人偏好。
- 支持人工确认后写入。

要求：

- 不允许 AI 自动修改个人偏好。
- 所有偏好变更必须可审计。

验收：

- 新项目初始化可复用用户偏好。

### Milestone 9：工具推荐引擎

目标：根据项目类型推荐工具组合。

任务：

- 建立评分模型。
- 支持必装 / 推荐 / 可选 / 不建议。
- 支持冲突检测。
- 支持上位替代提示。
- 支持维护成本评估。

验收：

- init 后能输出清晰推荐列表。

### Milestone 10：插件 SDK

目标：允许第三方工具接入。

任务：

- 定义 Tool Provider API。
- 定义 Capability Contract。
- 定义 Adapter Contract。
- 定义 Doctor Check Contract。
- 定义 UI Card Contract。

验收：

- 第三方工具可以注册成新的能力实现。

## 6. 长期路线

### Phase 2

- Developer DNA
- Team DNA
- Usage Statistics
- Tool Recommendation
- Prompt Recommendation
- Compatibility Layer 完整实现
- 多项目管理

### Phase 3

- Learning Engine（人工审核模式）
- Marketplace
- Cloud Sync（可选）
- Team Workspace
- 第三方 Tool Provider

## 7. 非目标

第一版和第二版都不做：

- 自动修改业务代码。
- 自动提交 Git。
- 自动上传代码。
- 自动联网同步。
- 自动替换工具。
- 无审核自动学习。

## 8. 成功标准

- 新项目初始化时间小于 30 秒。
- 初始化不修改业务代码。
- 所有生成文件可追踪、可回滚。
- Agent 配置通过 Compatibility Layer 输出。
- 工具通过能力槽位替换，不影响工作流。
- 开发者能通过装备栏快速知道当前项目 AI 工具状态。


## 11. v0.1.7 开发重点

本版本聚焦“状态可解释性”和“槽位边界更清楚”。

- UI 将装备分成五组：外部工具、项目内置能力、Agent 适配、人工确认、推荐未安装 / 不可用。
- Doctor 输出机器可读的 `slots` 矩阵，后续 UI、Gateway、Adapter 都可以基于该矩阵消费状态，而不是只解析自然语言检查项。
- 推荐未安装工具仍可出现在 UI，但必须放入独立分组，并用 warning 状态展示，避免误认为工具已经安装。
- `human_confirmation` 保持 category=`interaction_tool`，slotType 默认仍使用 `exclusive_priority`，表示多个人工确认通道时排序第一项生效。
- `agent_compatibility` 保持 slotType=`internal_adapter`，只负责生成/桥接 Agent 规则，不负责用户确认。
- CLI 继续坚持命令式接入：AI 可以执行 `create-slot`、`register-tool`、`equip`、`toggle`，但不应直接手改 `.ai-toolops/*.json`。


## 12. v0.1.8 开发重点

本版本聚焦“Agent 规则落地”和“有效策略可读”。

- 新增 `generate-agent-rules`，把 `equipment.json`、`tool-registry.json`、`health-report.json` 转换为 Agent 更容易遵守的 Markdown 策略。
- 新增 `sync-agent-rules`，把最小 ToolOps 引用块写入 `AGENTS.md`，避免用户手动维护长规则。
- 新增 `.ai-toolops/effective-policy.md`，作为 Agent 工具选择的首选入口。
- 新增 `.ai-toolops/generated/AGENTS.toolops.md`，作为通用 Agent 规则文件。
- 新增 `.ai-toolops/generated/CODEX.toolops.md`、`CLAUDE.toolops.md`、`ROO.toolops.md`，为后续 Compatibility Layer 真正生成不同 Agent 配置打基础。
- 所有配置变更命令都刷新派生规则，确保 UI、Doctor、Agent 规则三者一致。

后续 v0.1.9 建议：

- UI 增加“Agent 规则”区域，展示有效策略文件路径和复制入口。
- Doctor 增加 `agentRules.synced` 检查，提示 `AGENTS.md` 是否包含 ToolOps 引用块。
- 为 `effective-policy.md` 增加更细的任务类型建议，如小改优先 exact_search、跨模块优先 code_graph。


## 13. v0.1.9 开发重点

本版本聚焦“按 Agent 执行流程组织装备”。

- 引入 `workflowStage`，让能力槽位能挂到 Agent 执行流程阶段。
- 引入 `relationGroup`，让相似或互补能力能在同一阶段内横向对比。
- UI 装备区从类型分组升级为流程阶段布局。
- 项目检索阶段明确表达 Semble / rg / 直接阅读的条件关系。
- AskHuman 规则写入生成策略，避免只靠人工维护 AGENTS.md。
- `create-slot` 支持 `--workflow-stage` 和 `--relation-group`。

后续 v0.2.0 建议：

- 开始设计 AI ToolOps MCP Gateway。
- Agent 不再直接连接各 MCP，而是只连接 Gateway。
- Gateway 根据 `equipment.json` 和 `effective-policy.md` 控制工具可见性和可调用性。


## v0.1.14 设计补充：agent_compatibility 适配器层

`agent_compatibility` 的职责已经从“普通装备卡片”升级为 ToolOps 内部适配层。

配置源：

```text
.ai-toolops/adapters.json
```

生成产物：

```text
.ai-toolops/adapters/index.md
.ai-toolops/adapters/codex.toolops.md
.ai-toolops/adapters/claude.toolops.md
.ai-toolops/adapters/roo.toolops.md
.ai-toolops/generated/CODEX.toolops.md
.ai-toolops/generated/CLAUDE.toolops.md
.ai-toolops/generated/ROO.toolops.md
```

边界：

- `agent_compatibility` 是内部适配层，不是普通外部工具。
- Adapter 不维护独立规则源，只把统一 ToolOps 策略翻译成不同 Agent 可读格式。
- 系统级 AGENTS.md 放用户固定偏好和全局兜底。
- 项目级 AGENTS.md 放项目路由和 ToolOps 轻量入口。
- 详细工具规则由 `.ai-toolops/generated/rules/*.md` 按需承载。
