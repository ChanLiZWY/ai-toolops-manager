# Windows v1.1 Provider 扩展评审

## 结论

v1.1 不新增可执行 Provider。继续保留：

- `rg`：ToolOps 托管安装、更新、卸载和修复。
- `external-command`：用户显式登记已有命令的绝对路径，ToolOps 不接管其安装来源。
- `Semble`、`AskHuman`、Agent MCP：只检测真实可用性，不由 ToolOps 安装。

这不是功能缺失，而是供应链边界。Provider 只有同时满足以下条件才进入核心：

1. Windows x64 有稳定的官方版本化资产。
2. 能取得由发布源提供的 SHA-256 或更强完整性证据。
3. 可以在普通用户目录中幂等安装，并能明确回滚。
4. 健康检查不依赖登录态、凭据或某个 Agent 的私有目录。
5. 跨项目复用价值明显，且不只是 PowerShell、`rg` 或 Agent 自带能力的重复包装。

## 候选结论

| 候选 | 当前结论 | 原因 |
|---|---|---|
| ripgrep | 保持 managed | 官方 Windows x64 资产和 `.sha256` 均存在；无登录态；跨项目价值高 |
| Semble | detection-only | 当前安装来自 Python 环境，缺少稳定的独立 Windows 资产、版本命令和统一回滚契约 |
| AskHuman | detection-only | 当前入口来自全局 Node 包并依赖交互宿主；ToolOps 接管会改变用户 Node/npm 环境 |
| Git | 不接管 | 安装和升级可能影响系统级开发环境；ToolOps 只应检测或允许用户登记 |
| GitHub CLI | 不接管 | 包含登录态和凭据边界；生命周期应继续由官方安装器或包管理器负责 |
| fd / jq 等 CLI | 暂不增加 | 与现有 PowerShell/rg 能力重叠，不能证明增加核心维护面后的净用户价值 |
| Agent MCP / Skill | 保持 Adapter/检测 | 配置和可用性属于具体 Agent；不能因一处安装而宣称跨 Agent 可用 |

## 后续准入方式

新增 Provider 必须单独提交一份来源、许可、版本、摘要、安装路径、健康检查、卸载和失败恢复证据。没有这些证据时，可以通过 `config external-tool add` 登记现有绝对路径，但不能进入 managed 生命周期。
