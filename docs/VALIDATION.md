# 验证记录 v0.1.8

## 语法检查

```bash
npm run check
```

结果：通过。

检查范围：

- `bin/ai-toolops.js`
- `src/cli.js`
- `src/utils.js`
- `src/scanner/projectScanner.js`
- `src/core/rollback.js`
- `src/core/doctor.js`
- `src/core/equipmentModel.js`
- `src/core/registries.js`
- `src/adapters/agentAdapters.js`
- `src/ui/generateUi.js`

## 初始化验证

在临时 Vue / uni-app 项目中执行：

```bash
ai-toolops init --yes
ai-toolops doctor
ai-toolops ui
```

结果：通过。

验证点：

- 生成 `.ai-toolops` 配置目录。
- 生成 `project.profile.json`、`project-dna.json`、`capabilities.json`、`tool-registry.json`、`equipment.json`。
- 生成 `adapters/codex.toolops.md`、`claude.toolops.md`、`roo.toolops.md`。
- UI 文件生成成功，`.ai-toolops/ui/app.js` 语法检查通过。

## v0.1.6 结构验证

验证点：

- `project-architecture-docs` 被标记为 `project_context` / `project_builtin`，Doctor 显示为“项目内置”。
- `package-scripts` 被标记为 `project_context` / `project_builtin`，Doctor 显示为“项目内置”。
- `compatibility-layer` 被放入 `agent_compatibility` 槽位，类型为 `internal_adapter`。
- `AskHuman` / `askhuman` 被放入 `human_confirmation` 槽位，类型为 `exclusive_priority`。
- `AskHuman` 不再与 `compatibility-layer` 共用旧 `agent_adapter` 槽位。
- Adapter 输出明确说明：`agent_compatibility` 负责 Agent 规则适配，`human_confirmation` 负责人工确认。

## 旧配置迁移验证

构造 v0.1.5 风格配置：

```json
{
  "slots": {
    "agent_adapter": {
      "tools": ["askhuman", "compatibility-layer"],
      "active": "askhuman"
    }
  }
}
```

执行：

```bash
ai-toolops doctor
```

结果：通过。

迁移结果：

- 旧 `agent_adapter` 自动拆分为：
  - `agent_compatibility` → `compatibility-layer`
  - `human_confirmation` → `askhuman`
- `tool-registry.json` 自动补齐 `askhuman -> human_confirmation` 能力声明。
- 不再出现 `capabilityMismatch`。

## UI 验证

验证点：

- 页面按“外部工具 / 项目内置能力 / Agent 适配”分组展示。
- 外部工具显示“已安装”。
- 项目文档和 package scripts 显示“项目内置”。
- compatibility-layer 显示“内置适配”。
- 互斥槽位显示“当前生效”。
- 非互斥槽位显示“当前启用”。
- 每行 1 / 2 / 3 / 4 张卡片切换仍可用。
- 全局加号生成的提示词已包含 `agent_compatibility` 和 `human_confirmation` 两个不同槽位。

## 非目标确认

本版本仍然不做：

- 真实 MCP Gateway 强制拦截。
- 自动安装外部工具。
- 自动修改业务代码。
- 自动上传或云端同步。


## v0.1.7 增量验证

### Doctor 状态矩阵

验证点：

- `health-report.json` 增加 `slots` 数组。
- `summary.statusCounts` 能统计 `installed`、`project_provided`、`built_in`、`recommended_not_installed` 等状态。
- disabled 槽位仍会进入 `slots` 矩阵，但 `effective` 为 `null`。

### UI 分组

验证点：

- UI 生成的 `app.js` 语法检查通过。
- 装备分组包含：外部工具、项目内置能力、Agent 适配、人工确认、推荐未安装 / 不可用。
- `human_confirmation` 进入人工确认分组。
- `semantic_search` / `code_graph` 等未安装推荐外部工具进入推荐未安装 / 不可用分组。
- 推荐未安装工具显示 warning 状态，不再显示为已可用。

### CLI 校验

验证点：

- `create-slot` 对非法 `--slot-type` 抛出错误，不再静默改写。
- `register-tool`、`equip`、`reorder-tools`、`doctor` 在新增槽位后仍可正常工作。

### UI 快照同步

验证点：

- UI API `/api/toggle` 写入 `equipment.json` 后，会同步更新 `.ai-toolops/ui/data.json` 中的 equipment 快照。
- UI API `/api/reorder-tools` 写入排序后，会同步更新 `.ai-toolops/ui/data.json` 中的 equipment 快照。


## v0.1.8 增量验证

### 语法检查

```bash
npm run check
```

结果：通过。

新增检查：

- `src/core/policyGenerator.js`

### Agent 规则生成

在临时项目中执行：

```bash
ai-toolops init --yes
ai-toolops doctor
ai-toolops generate-agent-rules --apply
ai-toolops sync-agent-rules
```

结果：通过。

验证点：

- 生成 `.ai-toolops/effective-policy.md`。
- 生成 `.ai-toolops/generated/AGENTS.toolops.md`。
- 生成 `.ai-toolops/generated/CODEX.toolops.md`、`CLAUDE.toolops.md`、`ROO.toolops.md`。
- `generate-agent-rules --apply` 会在 `AGENTS.md` 写入 `<!-- AI ToolOps:begin -->` / `<!-- AI ToolOps:end -->` 管理块。
- `sync-agent-rules` 可重复执行，并会替换旧管理块，不会重复追加。
- 推荐未安装的排序第一工具会在 `effective-policy.md` 中显示为“不可用，不得调用”。
- disabled 槽位在 `effective-policy.md` 中显示为“槽位已关闭，不得使用”。

### 派生文件刷新

验证点：

- `init` 会生成 Agent 策略文件。
- `doctor` 会刷新 Agent 策略文件。
- `equip`、`toggle`、`reorder-tools`、`register-tool`、`create-slot` 会刷新 Agent 策略文件。

### 非目标确认

本版本仍然不做：

- MCP Gateway 硬拦截。
- 自动安装外部工具。
- 自动调用第三方 Agent 配置 API。
- 自动上传代码或同步云端。


## v0.1.9 验证项

- `npm run check` 覆盖新增 `src/core/workflow.js`。
- `ai-toolops init --yes` 后，默认槽位应写入 `workflowStage` 与 `relationGroup`。
- `ai-toolops doctor` 后，`.ai-toolops/effective-policy.md` 应包含 Agent 通用执行流程、文件查找策略、AskHuman 使用规则。
- `.ai-toolops/ui/data.json` 应包含 `workflowStages`。
- 生成的 `.ai-toolops/ui/app.js` 应通过 `node --check`。
- `ai-toolops create-slot <slot> --workflow-stage <阶段>` 应写入指定流程阶段。
- 非法 `--workflow-stage` 应失败。


## v0.1.10 验证项

- `npm run check` 通过。
- `ai-toolops init --yes` 后应生成 `.ai-toolops/generated/rules/` 目录。
- `ai-toolops generate-agent-rules --apply` 后，`AGENTS.md` 中的 AI ToolOps 管理块应为轻量入口，不应包含完整 AskHuman / Semble 细则。
- `.ai-toolops/generated/AGENTS.toolops.md` 应为规则索引，包含按需加载说明。
- `.ai-toolops/generated/rules/project-retrieval.md` 应包含 Semble / rg / 直接阅读策略。
- `.ai-toolops/generated/rules/feedback.md` 应包含 AskHuman 使用规则。
- `.ai-toolops/effective-policy.md` 应保留完整有效能力矩阵，但注明只在需要工具决策时读取。


## v0.1.14 验证项

### 语法检查

```bash
npm run check
```

结果：通过。

新增检查：

- `src/core/adapterConfig.js`

### Adapter 封装验证

在临时项目中执行：

```bash
ai-toolops setup
ai-toolops adapters list
ai-toolops adapters disable claude
ai-toolops sync-agent-rules --agent codex
```

结果：通过。

验证点：

- 生成 `.ai-toolops/adapters.json`。
- 生成 `.ai-toolops/adapters/index.md`。
- `agent_compatibility` 默认装备 `codex-adapter`、`claude-adapter`、`roo-adapter`。
- `adapters disable claude` 会更新 `.ai-toolops/adapters.json` 并刷新派生规则。
- 被关闭的 Claude 适配文件会明确提示该适配器已关闭，不应作为当前规则入口。
- `.ai-toolops/effective-policy.md` 包含 Agent 兼容层说明。
- `.ai-toolops/ui/data.json` 包含 adapters 快照。
- `.ai-toolops/ui/app.js` 语法检查通过。

### 自我审核

- Adapter 只负责规则翻译，不再作为第三份独立规则源。
- 工具启用 / 禁用 / 优先级仍以 `.ai-toolops/equipment.json` 为事实源。
- Agent 专用文件是生成产物，不应手动维护。
- 系统级 AGENTS.md、项目级 AGENTS.md、ToolOps 生成规则保持分层，避免详细规则重复。
