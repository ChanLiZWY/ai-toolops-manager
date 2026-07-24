# AI ToolOps Manager Windows v1 总路线状态

## 当前状态

```yaml
current_phase: windows-v1.1-p0
current_status: ready_for_release
last_completed_task: windows-v1.1-p0.task-5
next_task: release-v1.1.0
blocked: false
block_reason: null
last_updated: 2026-07-24
```

## Phase

- [x] Phase 1：项目意图、电脑状态、Agent 状态、Context 与只读 Doctor。
- [x] Phase 2：Windows 工具生命周期、事务、库存、bootstrap 与迁移。
- [x] Phase 3：Agent Adapter、独立 EXE、用户级安装与自更新。
- [x] Phase 4：本地 UI、旧功能清理、自动化和当前电脑验收。

各阶段的接口、任务、回滚和执行记录见同目录下的独立 Phase 计划。

## 已实现边界

- Windows 10/11 x64、普通用户、NTFS 方向。
- 最终用户使用 `ai-toolops.exe`，不要求安装 Node。
- 项目只保存 `.ai-toolops/policy.yaml` 与 `.ai-toolops/toolops.lock.json`。
- 机器状态保存到 `%LOCALAPPDATA%\ai-toolops`，程序保存到 `%LOCALAPPDATA%\Programs\ai-toolops`。
- Tool Provider 与 Agent Adapter 分离。
- generic、Codex、Claude、Roo 隔离；未知 Agent 安全回退 generic。
- 所有变更先生成 ActionPlan，支持 dry-run、确认、回执和失败恢复。
- 本地 UI 只绑定 `127.0.0.1`，使用会话 token 和服务器缓存计划。

## 当前自动验收

```text
npm run check       PASS
npm test            PASS (11/11)
npm run build:windows PASS
npm run smoke:windows PASS
UI 1440px / 375px   PASS
```

独立程序 SHA-256：

```text
34ce6607880d05bd41c2c177ef655b223978c6d5bbd66dcb5844d5df3bcbf7dd
```

安装器 SHA-256：

```text
ca73c39e791a5cb3fcdcc8c9643497213cb511ede190895b2bdda7e678e68a30
```

## 发布前外部验收

以下需要在目标系统或发布环境执行，不用文档冒充完成：

- [ ] Windows 10 x64 普通用户实机矩阵。
- [ ] Windows 11 x64 普通用户干净账号矩阵。
- [ ] Defender 开启状态下的下载、安装、更新与误报记录。
- [ ] 真实文件占用场景下的替换失败与恢复。
- [ ] 正式发布证书或其他可信发布完整性方案。

## 执行记录

| 时间 | Phase | 结果 |
|---|---|---|
| 2026-07-24 | Phase 1 | 新状态模型、Context、Doctor 和迁移预检完成 |
| 2026-07-24 | Phase 2 | 事务、库存、rg Provider、bootstrap 和正式迁移完成 |
| 2026-07-24 | Phase 3 | Agent 隔离、SEA 独立程序、安装/卸载和自更新完成 |
| 2026-07-24 | Phase 4 | UI、旧功能删除、文档和自动验收完成 |
| 2026-07-24 | Phase 4 | UI 增加原生目录选择与最近项目切换，开始菜单入口可直接跨项目使用 |
