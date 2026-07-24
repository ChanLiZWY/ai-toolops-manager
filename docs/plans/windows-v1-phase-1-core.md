# AI ToolOps Manager Windows v1 Phase 1 可执行计划

## 0. 执行规则

1. 先新增 v1 领域模型，再切换 CLI；迁移验收前不删除旧读取代码。
2. `context`、`doctor`、`migrate --dry-run` 必须是只读操作。
3. 项目事实只允许写入 `.ai-toolops/policy.yaml` 与 `.ai-toolops/toolops.lock.json`。
4. Windows 绝对路径、健康状态、Agent 配置来源只允许存在于机器状态或运行时结果。
5. 每项任务完成后运行语法检查和对应测试。

## 1. 当前进度

```yaml
phase_id: phase-1
status: done
last_completed_task: phase-1.task-5
next_task: null
blocked: false
block_reason: null
```

## 2. 已锁定接口

- 项目意图：`.ai-toolops/policy.yaml`，包含 `schemaVersion`、`capabilities` 和 `safety`。
- 锁文件：`.ai-toolops/toolops.lock.json`，包含 `schemaVersion`、`tools` 和解析时间。
- 机器根目录：`%LOCALAPPDATA%\ai-toolops`，测试可通过 `AI_TOOLOPS_HOME` 覆盖。
- 状态维度：`installation`、`binding`、`health`、`resolution`。
- Agent：`auto|generic|codex|claude|roo`；`auto` 无可信标识时必须回退 `generic`。
- `context` 输出文本和 JSON；`doctor` 输出检查列表；`migrate --dry-run` 输出迁移报告。

## 3. 任务

- [x] phase-1.task-1：创建并评审本计划。
  - 输出：本文件。
  - 验收：包含接口、任务、测试、删除边界和恢复方式。

- [x] phase-1.task-2：实现项目配置、Windows 机器路径和库存兼容读取。
  - 输出：`src/v1/config.js`、`src/v1/windows-store.js`。
  - 验收：项目 schema 拒绝绝对路径、健康状态和凭据字段；机器目录可被测试隔离。
  - 边界：只读取旧 JSON，不删除或改写。

- [x] phase-1.task-3：实现 Agent 隔离发现、Resolver 和 context renderer。
  - 输出：`src/v1/agents.js`、`src/v1/resolver.js`。
  - 验收：Codex 配置不会进入 Claude 结果；auto 无证据回退 generic。
  - 边界：不修改 Agent 配置。

- [x] phase-1.task-4：实现只读 Doctor 和迁移预检。
  - 输出：`src/v1/doctor.js`、`src/v1/migration.js`。
  - 验收：执行前后文件哈希一致；报告列出迁移、丢弃和冲突项。
  - 边界：不执行正式迁移。

- [x] phase-1.task-5：切换 CLI 的 `init/context/doctor/migrate --dry-run` 并补充测试。
  - 输出：v1 CLI 入口和 `test/v1-core.test.js`。
  - 验收：新命令通过测试；旧项目仍可被迁移预检读取。
  - 边界：安装、更新、卸载暂返回 Phase 2 提示。

## 4. 验收

- [x] `npm run check` 通过。
- [x] `npm test` 通过。
- [x] 新项目只生成 policy 和 lock。
- [x] context/doctor/migrate dry-run 默认零写入。
- [x] 空格和中文项目路径通过测试。

## 5. 不做事项

- 不实现 Provider 执行、工具下载、Agent 写入和 UI。
- 不删除旧模块。
- 不联网。

## 6. 中断恢复

恢复时从 `next_task` 开始；若 CLI 已切换但测试失败，保留新模块并将 CLI 临时切回最后通过测试的入口。

## 7. 执行记录

| 时间 | 任务 | 结果 |
|---|---|---|
| 2026-07-24 | phase-1.task-1 | 基线测试 9/9 通过，计划创建完成 |
| 2026-07-24 | phase-1.task-2..5 | v1 状态分层、context、只读 Doctor、迁移预检完成；15/15 测试通过 |

## 8. 变更记录

| 时间 | 内容 | 原因 |
|---|---|---|
| 2026-07-24 | 初始化 Phase 1 计划 | 开始 Windows v1 实施 |
