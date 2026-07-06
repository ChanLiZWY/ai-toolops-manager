# AI ToolOps Manager v0.1.9 设计审查与调整

## 背景

v0.1.8 已经能生成 Agent 规则和有效策略文件，但 UI 的装备卡片仍偏“工具类型分组”。这会造成两个问题：

1. 相似或互补能力被分散展示，用户不容易判断什么时候用 Semble、什么时候用 rg、什么时候直接读文件。
2. Agent 读策略时缺少“执行流程”视角，容易只按工具名理解能力，而不是先判断当前任务阶段。

## 设计结论

装备布局应该同时支持两种维度：

- **流程阶段**：Agent 做任务的大致顺序，例如规则入口、项目上下文、项目检索、验证、反馈。
- **能力关系**：相似或互补能力，例如 `exact_search` 与 `semantic_search` 同属 `file_lookup`。

因此，v0.1.9 引入：

- `workflowStage`
- `relationGroup`

## 默认流程阶段

当前默认流程阶段为：

1. `agent_rules`：规则入口 / Agent 适配
2. `prompt_intake`：需求理解 / 提示词优化
3. `project_context`：项目上下文
4. `project_retrieval`：项目检索
5. `thinking_strategy`：思考策略
6. `planning`：列计划
7. `execution`：执行修改
8. `validation`：验证
9. `feedback`：反馈 / 人工确认

当前已有槽位映射：

- `agent_compatibility` -> `agent_rules`
- `architecture_context` -> `project_context`
- `exact_search` -> `project_retrieval`
- `semantic_search` -> `project_retrieval`
- `code_graph` -> `project_retrieval`
- `build_validation` -> `validation`
- `human_confirmation` -> `feedback`

## Semble / rg / 直接阅读策略

v0.1.9 将以下规则写入 `.ai-toolops/effective-policy.md` 和 `.ai-toolops/generated/AGENTS.toolops.md`：

1. 目标文件明确、IDE 已定位、或用户已点名文件时，直接查看该文件。
2. 已知组件/依赖关系明确时，直接查看相关文件；跨文件阅读不等于跨文件检索。
3. 只有入口不明确、调用链不明确、确实需要在未知文件中定位实现/调用/影响面时，跨文件检索才优先用 Semble；Semble 无结果再用 rg 兜底。

## AskHuman 使用规则

v0.1.9 将 AskHuman 规则写入生成策略，而不是只靠人工维护 AGENTS.md：

1. 需要询问用户时，必须通过 Shell 调用 `AskHuman.exe`，不要在普通回复里提问；调用前先运行 `AskHuman.exe --agent-help`，工具超时设为 24 小时（`86400000 ms`）。
2. 执行需求时，先自行阅读代码、文档、配置、接口、测试或运行命令确认信息；只有问题会影响实现范围、数据来源、交互行为、接口契约、验收标准或高风险操作时，才用 AskHuman 确认。
3. 提问可汇总，每次最多 3 个关键问题；每题提供 2-3 个选项；有推荐项时用 `-o!` 标出，并用一句话说明理由。
4. 小改动、明确修复、普通状态同步、可安全默认处理的问题，不要打断用户。
5. 结束本次请求前，必须用 `AskHuman.exe` 请求反馈；只有用户明确选择结束/不继续时，才发送最终总结。

## UI 调整

- 装备卡片按 Agent 流程阶段渲染。
- 每个流程阶段左侧显示流程说明，右侧显示同阶段能力卡片。
- 相似或互补能力在同一阶段内横向排列，仍支持每行 1/2/3/4 张卡片。
- 推荐未安装或不可用工具不再必须挪到单独分组，而是在对应流程阶段内以 warning 卡片展示。

## CLI 调整

`create-slot` 新增：

```bash
ai-toolops create-slot <slot> --label <名称> --workflow-stage <阶段> --relation-group <互补分组>
```

非法 `workflowStage` 会报错，避免写入无效布局配置。
