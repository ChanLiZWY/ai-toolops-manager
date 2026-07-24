# Changelog

## 1.0.0 - 2026-07-24

- 产品范围收敛为 Windows 10/11 x64 普通用户安装。
- 项目状态改为 `.ai-toolops/policy.yaml` 与 `.ai-toolops/toolops.lock.json`。
- 电脑库存、托管工具、回执、迁移和 Agent 绑定状态改存 `%LOCALAPPDATA%\ai-toolops`。
- 新增统一 `context`、只读 `doctor`、可信 Agent 自动检测和 generic 安全回退。
- 新增 ActionPlan、dry-run、确认、事务锁、回执、回滚和失败恢复。
- 新增 Windows x64 `rg` 内置 Provider，支持检测、安装、更新、卸载和修复。
- 新增 `bootstrap --locked`、旧项目迁移预检、正式迁移及迁移回滚。
- 真实项目迁移会丢弃项目文档、package scripts 和旧 Agent Adapter 等非工具槽位；兼容 Codex 中的 `codebase_memory` MCP 名称。
- Agent Adapter 与 Tool Provider 分离；Codex、Claude、Roo 绑定互不污染。
- 新增 Node SEA 独立 `ai-toolops.exe`、用户级安装/卸载和安全自更新流程。
- 重做本地 Web UI；五个页面使用真实应用服务并要求计划确认。
- 本地 UI 新增 Windows 目录选择、项目路径输入和最多 8 个最近项目，开始菜单入口可直接切换跨项目上下文。
- 优化本地 UI 的窗口化视觉：深色工具侧栏、统一 SVG 图标、紧凑项目入口、稳定内容宽度和 375px 响应式布局。
- 便携版 `ai-toolops.exe` 无参数启动时直接打开本地 UI；命令帮助改为显式使用 `--help`。
- 新增自包含 `ai-toolops-setup.exe`：当前用户安装、PATH、开始菜单、可选桌面快捷方式、Windows 卸载项、覆盖升级和失败恢复。
- 删除装备卡片、Skill 次数、插件扫描、规则 Markdown 生成、伪安装 UI 和其他重复状态。

## 0.x

0.x 是装备模型、插件扫描和规则 Markdown 生成的实验版本。其项目数据只通过 `ai-toolops migrate` 兼容，不再保留对应运行时命令。
