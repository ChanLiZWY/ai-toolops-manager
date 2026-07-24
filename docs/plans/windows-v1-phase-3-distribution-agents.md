# AI ToolOps Manager Windows v1 Phase 3 可执行计划

## 0. 执行规则

1. Agent 绑定保持手工接入：ToolOps 展示统一规则并记录状态，不擅自写宿主全局配置。
2. Codex、Claude、Roo 的检测来源严格隔离。
3. 独立程序只构建 Windows x64；开发/npm 入口继续支持 Node 23。
4. 用户 PATH 只有安装脚本显式 `-AddToPath` 时才修改。
5. 自更新必须先校验 SHA-256，运行中的 EXE 由独立 PowerShell helper 替换。

## 1. 当前进度

```yaml
phase_id: phase-3
status: done
last_completed_task: phase-3.task-5
next_task: null
blocked: false
block_reason: null
```

## 2. 契约

- Adapter：`metadata/detect/status/planBind/planUnbind/apply`，不持有项目策略。
- 绑定记录：`%LOCALAPPDATA%\ai-toolops\agents\<agent>\bindings.json`。
- 绑定方法：`manual-instruction`；记录统一 context 规则和最近确认时间。
- 构建：esbuild 将 ESM 和依赖打成 CJS，再注入当前 Node 23 SEA。
- 安装位置：`%LOCALAPPDATA%\Programs\ai-toolops\ai-toolops.exe`。
- 更新：本地文件或 HTTPS artifact + SHA-256；helper 等待父进程退出后替换并验证。

## 3. 任务

- [x] phase-3.task-1：创建并评审本计划。
- [x] phase-3.task-2：实现 Agent Adapter、bind/unbind/status CLI 和隔离测试。
- [x] phase-3.task-3：实现 Windows SEA 构建、版本 smoke test 和校验文件。
- [x] phase-3.task-4：实现用户级安装、卸载和可选用户 PATH。
- [x] phase-3.task-5：实现 self-update 计划、helper 和失败恢复测试。

## 4. 验收

- [x] Agent 绑定只写机器绑定记录。
- [x] Codex 绑定不影响 Claude/Roo。
- [x] `dist/ai-toolops.exe --version/context/doctor` 无 Node 环境依赖。
- [x] 安装/卸载不要求管理员权限。
- [x] 更新 helper 先备份旧 EXE，验证失败恢复旧版本。

## 5. 不做事项

- 不自动编辑 Agent 全局规则。
- 不支持 ARM64、macOS、Linux。
- 不做后台更新和证书购买；v1 使用发布校验文件，签名方案保留扩展点。

## 6. 中断恢复

构建失败不影响 npm 入口；更新 helper 保留 `.backup`，下次启动可检查并恢复。

## 7. 执行记录

| 时间 | 任务 | 结果 |
|---|---|---|
| 2026-07-24 | phase-3.task-1 | 手工 Agent 接入和 Windows SEA 边界确定 |
| 2026-07-24 | phase-3.task-2..5 | Agent 绑定、SEA、用户级安装卸载、自更新完成；11/11 测试和分发 smoke 通过 |
| 2026-07-24 | 安装体验补强 | 新增自包含 setup.exe、PATH、开始菜单、可选桌面快捷方式和 Windows 卸载项 |

## 8. 变更记录

| 时间 | 内容 | 原因 |
|---|---|---|
| 2026-07-24 | 初始化 Phase 3 计划 | 开始 Agent 与独立程序实施 |
