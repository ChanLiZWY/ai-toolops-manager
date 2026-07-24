# AI ToolOps Manager Windows v1 Phase 2 可执行计划

## 0. 执行规则

1. 所有变更先生成可序列化 ActionPlan；`--dry-run` 不得创建机器目录。
2. 事务持有 `%LOCALAPPDATA%\ai-toolops\.lock`，结束后必须释放。
3. 库存只有在工具完成校验和健康检查后才能提交。
4. Provider 只处理工具，不读取或修改 Agent 配置。
5. 测试使用 `AI_TOOLOPS_HOME` 和本地 fixture，默认不访问网络。

## 1. 当前进度

```yaml
phase_id: phase-2
status: done
last_completed_task: phase-2.task-5
next_task: null
blocked: false
block_reason: null
```

## 2. 契约

- ActionPlan：`id/action/providerId/changes/permissions/rollbackSupported`。
- Receipt：`id/planId/status/steps/rollback/error/timestamps`。
- Provider：`metadata/detect/healthCheck/plan/apply/rollback`。
- 首个托管 Provider：`rg`；支持固定版本的 Windows x64 ZIP、本地 artifact 覆盖和 SHA-256。
- 外部工具：只登记绝对路径，不复制、不卸载外部文件。
- 正式迁移：旧目录备份到机器级 `migrations`，写入新两个文件，回滚通过迁移回执恢复。

## 3. 任务

- [x] phase-2.task-1：创建并评审本计划。
- [x] phase-2.task-2：实现文件锁、ActionPlan、事务回执和恢复。
  - 输出：`src/v1/transaction.js`。
  - 验收：失败不提交库存；并发事务被拒绝；dry-run 零写入。
- [x] phase-2.task-3：实现 Provider registry、external-command 和 rg Provider。
  - 输出：`src/v1/providers/`。
  - 验收：本地 ZIP fixture 可安装、校验、更新、修复和卸载。
- [x] phase-2.task-4：实现生命周期服务、bootstrap 和正式迁移/回滚。
  - 输出：`src/v1/lifecycle.js`、迁移执行服务。
  - 验收：两个项目复用库存；失败恢复；迁移可逆。
- [x] phase-2.task-5：接通 CLI 并补充集成测试。
  - 输出：install/update/uninstall/bootstrap/config/migrate 命令。
  - 验收：所有变更命令支持 JSON、dry-run 和非交互确认。

## 4. 验收

- [x] 事务和 Provider 测试通过。
- [x] 路径空格、中文和损坏校验有覆盖；文件占用由隔离改名失败触发事务回滚。
- [x] 外部工具绝对路径只在机器库存。
- [x] 新电脑目录可按锁文件恢复。

## 5. 不做事项

- 不修改 PATH。
- 不实现 Agent 绑定、自更新和 UI。
- 不执行第三方 Provider 代码。

## 6. 中断恢复

以 receipt 和库存为准；发现 `.lock` 且拥有者进程不存在时，先生成恢复诊断，确认后清理。

## 7. 执行记录

| 时间 | 任务 | 结果 |
|---|---|---|
| 2026-07-24 | phase-2.task-1 | Phase 2 契约与测试边界确定 |
| 2026-07-24 | phase-2.task-2..5 | 事务、Provider、生命周期、bootstrap、迁移与 CLI 完成；17/17 测试通过 |

## 8. 变更记录

| 时间 | 内容 | 原因 |
|---|---|---|
| 2026-07-24 | 初始化 Phase 2 计划 | 开始真实工具生命周期实现 |
