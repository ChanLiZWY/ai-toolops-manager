# 设计审查 v0.1.8

## 目标

v0.1.8 解决的问题不是“能不能管理工具”，而是“Agent 能不能按 ToolOps 配置使用工具”。

v0.1.7 已经把槽位、状态、UI 分组和 Doctor 矩阵理清，但 Agent 如果只看到 JSON，仍可能出现这些问题：

- 忽略 `enabled=false`，直接调用本机可用工具。
- 把推荐未安装工具当作已可用工具。
- 把 `project_context` 误解为外部工具安装任务。
- 把 `internal_adapter` 当作普通开发工具。
- 直接手改 `.ai-toolops/*.json`。

## 设计结论

只在 `AGENTS.md` 加一句“请读取配置”不够。v0.1.8 采用生成式规则文件：

- `AGENTS.md` 只保留稳定引用块。
- `.ai-toolops/effective-policy.md` 承担主要策略解释。
- `.ai-toolops/generated/AGENTS.toolops.md` 承担通用 Agent 规则。
- `.ai-toolops/generated/CODEX.toolops.md`、`CLAUDE.toolops.md`、`ROO.toolops.md` 承担不同 Agent 的后续适配入口。

这样既避免手写规则过期，也让 Agent 不必直接理解完整 JSON。

## 新增命令

```bash
ai-toolops generate-agent-rules [--apply]
ai-toolops sync-agent-rules
```

`generate-agent-rules` 生成规则文件；带 `--apply` 时同步 `AGENTS.md` 管理块。

`sync-agent-rules` 等价于生成规则并同步 `AGENTS.md` 管理块。

## 关键约束

- 生成文件是派生物，不应手改。
- 配置源头仍是 `.ai-toolops/equipment.json`、`tool-registry.json`、`capabilities.json`。
- 变更配置仍必须走 `ai-toolops` 命令。
- v0.1.8 仍属于软约束，不是系统级硬拦截。

## 后续方向

v0.1.9 可以增加 UI 规则页和 Doctor 的 Agent 规则同步检查。

v0.2.0 再通过 AI ToolOps MCP Gateway 做硬拦截，让 Agent 只能看到 Gateway 暴露的工具。
