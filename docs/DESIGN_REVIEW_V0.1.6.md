# v0.1.6 设计审查

## 结论

v0.1.6 的核心方向正确：AI ToolOps Manager 没有把自己伪装成 Agent 或 MCP，而是把工具治理上移到“能力槽位”层，并且已经完成了最关键的拆分：`compatibility-layer`、`AskHuman`、`project-architecture-docs`、`package-scripts` 不再混在同一类“外部工具”里。

## 已经合理的设计

- `compatibility-layer` 放入 `agent_compatibility`，职责是 Agent 规则兼容。
- `AskHuman` 放入 `human_confirmation`，职责是人工确认。
- `project-architecture-docs` 放入 `architecture_context`，并标记为项目内置上下文。
- `package-scripts` 放入 `build_validation`，并标记为项目内置验证入口。
- `codebase-memory-mcp` 放入 `code_graph`，不新增大类，符合“代码结构 / 调用链 / 引用关系分析”的边界。
- `enabled` 控制槽位是否可用，`tools[0]` 控制互斥优先级槽位当前生效工具，符合当前“配置层控制 + Agent 规则约束”的阶段定位。

## v0.1.6 主要不足

- UI 只分为外部工具、项目内置能力、Agent 适配三组，`human_confirmation` 容易被归入普通外部工具。
- 推荐未安装工具在 UI 中被过滤掉，虽然能避免误解，但不利于用户知道“下一步推荐装什么”。
- Doctor 主要输出自然语言检查项，缺少可给 UI / Gateway / Adapter 直接消费的槽位状态矩阵。
- `create-slot` 接受任意 `--slot-type`，非法值会在 normalize 阶段被静默改成 `exclusive_priority`，容易造成配置和用户预期不一致。
- UI 内开关和排序写入 `equipment.json` 后，没有同步更新 `ui/data.json`，刷新页面可能看到旧快照。

## v0.1.7 处理策略

- Doctor 增加 `slots` 状态矩阵和 `summary.statusCounts`。
- UI 分组扩展为五组：外部工具、项目内置能力、Agent 适配、人工确认、推荐未安装 / 不可用。
- 推荐未安装工具单独展示，状态用 warning，不再伪装成可用装备。
- `create-slot` 增加槽位类型校验。
- UI API 写入 equipment 后同步刷新 `ui/data.json` 中的 equipment 快照。
