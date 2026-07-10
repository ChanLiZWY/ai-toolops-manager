<!-- AI ToolOps:begin -->
## AI ToolOps 入口

如果项目存在 `.ai-toolops/`，Agent 先读取：

- `.ai-toolops/generated/AGENTS.toolops.md`

它是工具规则索引，不是业务上下文。详细规则按需读取，不要在普通任务中一次性加载所有 ToolOps 文件。

按需加载原则：

- 需要判断工具启用、禁用、优先级或可用性时，读取 `.ai-toolops/effective-policy.md`。
- 需要项目检索、Semble / rg / 直接读文件策略时，读取 `.ai-toolops/generated/rules/project-retrieval.md`。
- 需要人工确认、提问或结束反馈时，读取 `.ai-toolops/generated/rules/feedback.md`。
- 需要新增、注册、启用、禁用或排序工具时，使用 `ai-toolops` 命令；禁止手动修改 `.ai-toolops/*.json`。
<!-- AI ToolOps:end -->
