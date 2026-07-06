# 设计审查 v0.1.10

## 背景

用户已有两层 AGENTS.md：

- 系统 / Codex 级 AGENTS.md：承载通用硬规则。
- 项目级 AGENTS.md：承载项目路由与按需读取策略。

v0.1.9 的问题是：ToolOps 同步块和 `AGENTS.toolops.md` 偏详细，容易让 Agent 在普通任务中一次性加载过多工具细则。

## 决策

1. `AGENTS.md` 只作为 ToolOps 轻量入口。
2. `.ai-toolops/generated/AGENTS.toolops.md` 只作为规则索引。
3. 详细规则拆到 `.ai-toolops/generated/rules/*.md`。
4. `.ai-toolops/effective-policy.md` 保留完整能力矩阵，但只在需要判断工具启用、禁用、优先级、可用性或 fallback 时读取。

## 结果

- 项目检索细则：`.ai-toolops/generated/rules/project-retrieval.md`。
- 人工确认细则：`.ai-toolops/generated/rules/feedback.md`。
- 其他阶段按实际存在槽位生成对应 stage 文件。
- `sync-agent-rules` 不再把详细规则塞进 `AGENTS.md`。
