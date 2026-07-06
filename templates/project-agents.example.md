# AGENTS.md

AI Agent 项目入口。更新：2026-07-05。
回复末尾附工具使用摘要（工具→用途，一句话）。

## AI ToolOps

如果项目存在 `.ai-toolops/`，先读取：

- `.ai-toolops/generated/AGENTS.toolops.md`

它是工具规则索引，不算业务上下文读取，不受下方“路由”表限制。

详细规则按需读取：

| 场景 | 读取 |
|------|------|
| 判断工具启用、禁用、优先级、可用性、fallback | `.ai-toolops/effective-policy.md` |
| 项目检索、Semble / rg / 直接读文件策略 | `.ai-toolops/generated/rules/project-retrieval.md` |
| AskHuman、用户确认、结束反馈 | `.ai-toolops/generated/rules/feedback.md` |
| Codex / Claude / Roo 专用适配 | `.ai-toolops/generated/CODEX.toolops.md` 等对应文件 |

禁止手动修改 `.ai-toolops/*.json`；工具新增、注册、启用、禁用、排序必须使用 `ai-toolops` 命令。

## 路由

判断会话类型，读取对应文件。未命中时不读取额外业务文件。
（`R` = `ai/agent-rules/`，`A` = `architecture/`）

| 任务 | 额外读取 |
|------|---------|
| 普通问答 / 规则解释 / 状态确认 | 无 |
| 文档更新 | 目标文档（最小范围编辑） |
| 页面修改 | `R/frontend-assets.md`、`R/coding-docs.md`、`A/modules.summary.yaml`、目标 `page.md` |
| 模块修改 | `R/architecture-workflow.md`、`R/coding-docs.md`、`A/modules.summary.yaml`、目标 `module.md` + `index.js` + `contract.js` |
| 架构讨论 | `A/modules.summary.yaml`、`A/current-architecture.md` |
| 架构编辑 | `R/architecture-workflow.md`、目标架构文档 |
| 运行时代码 | 上述对应文件 + `R/coding-docs.md` |
| review / 测试 / 安全 | `R/validation-response.md` |
| Git | `R/git.md` |
| 检索上下文 | `R/read-scope.md`、`ai/tooling.config.json` |

## 禁止读取（未命中上表）

`DOCS.md`（仅更新时最小编辑）、`ai/README.md`、`A/archive/**`（仅追溯历史）。
