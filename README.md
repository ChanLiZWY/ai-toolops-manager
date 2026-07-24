# AI ToolOps Manager

AI ToolOps Manager 是面向 Windows 10/11 x64 的本地 AI 开发工具管理器。它把三类状态明确分开：

- 项目需要哪些能力。
- 当前 Windows 用户安装了哪些工具。
- 当前 Agent 实际暴露了哪些 CLI/MCP 能力。

它不是 Agent Gateway，不代理工具调用，也不会用生成 Markdown 或提示词冒充真实安装。

## 支持范围

- Windows 10/11 x64
- 普通用户权限
- PowerShell 5.1+
- 独立 `ai-toolops.exe`，最终用户不需要 Node
- 源码开发和 npm fallback 需要 Node 22+；本项目使用 Node 23 验证

不支持 macOS、Linux、WSL 原生安装、Windows ARM64、系统级多用户安装和后台服务。

## 快速开始

普通用户推荐双击：

```powershell
.\dist\ai-toolops-setup.exe
```

安装器会在用户确认后：

- 安装到 `%LOCALAPPDATA%\Programs\ai-toolops\`，不要求管理员权限。
- 加入用户 PATH。
- 创建开始菜单快捷方式。
- 询问是否创建桌面快捷方式。
- 注册 Windows“已安装的应用”卸载项。
- 安装或升级成功后打开本地 UI。

`dist\ai-toolops.exe` 是无需安装的便携版主程序。双击它会打开本地管理 UI；在终端中不带参数运行 `ai-toolops` 也会打开 UI。它不会自行创建 PATH、快捷方式或卸载项。

从开始菜单打开 UI 后，可在顶部“当前项目”入口中：

- 使用 Windows 目录选择窗口打开已初始化项目。
- 粘贴项目绝对路径并打开。
- 在最多 8 个最近项目之间切换。

最近项目只保存在 `%LOCALAPPDATA%\ai-toolops\ui.json`，不会写进项目配置。尚未初始化的目录需要先运行 `ai-toolops init --project <目录>`。

开发和自动化环境仍可直接使用 PowerShell 脚本：

```powershell
.\scripts\install-windows.ps1 -Source .\dist\ai-toolops.exe -AddToPath -CreateStartMenuShortcut -RegisterUninstall
```

在项目中初始化：

```powershell
ai-toolops init
ai-toolops context --agent auto
ai-toolops doctor
```

初始化后，项目稳定配置只有：

```text
.ai-toolops/
  policy.yaml
  toolops.lock.json
```

项目文件不保存绝对路径、健康状态、用户名、Agent 缓存、凭据或回执。

电脑库存和操作回执位于：

```text
%LOCALAPPDATA%\ai-toolops\
```

## Agent 接入

在 Codex、Claude、Roo 或其他 Agent 中手工添加一句：

> 执行任务前运行 `ai-toolops context --project . --agent auto`，阅读并遵守输出的能力、工具状态和选择规则；命令不可用或必需能力缺失时先报告并执行建议的恢复步骤。

`auto` 只有获得可信宿主标识时才解析为具体 Agent，否则安全回退 `generic`。generic 模式不会把其他 Agent 的 MCP 配置报告为当前可用。

查看或记录手工绑定：

```powershell
ai-toolops agent detect
ai-toolops agent status
ai-toolops agent bind codex --dry-run
ai-toolops agent bind codex --yes
```

绑定命令只写电脑级确认记录，不擅自修改 Agent 全局规则。

## 日常命令

```text
ai-toolops init
ai-toolops context [--agent auto] [--json] [--strict]
ai-toolops doctor [--agent auto] [--json] [--strict]
ai-toolops install <tool> [--dry-run|--yes]
ai-toolops update <tool>|--all [--dry-run|--yes]
ai-toolops uninstall <tool> [--dry-run|--yes]
ai-toolops bootstrap --locked [--dry-run|--yes]
ai-toolops migrate --dry-run
ai-toolops migrate --yes
ai-toolops migrate rollback [id] --yes
ai-toolops config external-tool add <name> --path <absolute-path>
ai-toolops ui [--project <path>] [--port 4177] [--no-open]
```

变更命令遵循同一流程：

1. 生成 ActionPlan。
2. 显示网络、进程和写入位置。
3. 用户确认。
4. 执行事务。
5. 写入 Receipt。
6. 失败时恢复项目锁、机器库存和托管文件。

非交互环境必须使用 `--yes`；只查看计划使用 `--dry-run`。

## 工具生命周期

v1 内置真实 `rg` Provider，支持：

- 安装
- 更新
- 健康检查
- 损坏修复
- 卸载
- 锁版本恢复

托管下载必须通过 SHA-256 校验。v1 不加载第三方 Provider、JavaScript 安装器或项目内插件目录；外部命令只通过 `config external-tool` 显式登记并执行检测。

登记系统外部工具时，绝对路径只写入电脑库存：

```powershell
ai-toolops config external-tool add my-tool --path C:\Tools\my-tool.exe --yes
```

## 新电脑恢复

将项目中的 policy 和 lock 提交到 Git。新 Windows 电脑安装 ToolOps 后运行：

```powershell
ai-toolops bootstrap --locked --dry-run
ai-toolops bootstrap --locked --yes
```

登录状态和凭据不会随项目复制。

## 本地 UI

```powershell
ai-toolops ui
```

UI 只绑定 `127.0.0.1`，写接口要求临时会话 token。页面包括：

- 环境总览
- 能力解析
- 电脑库存
- 事务回执
- Agent 手工接入和外部工具登记

UI 的变更按钮先从服务器生成 ActionPlan，再显示确认窗口；不存在“按钮只弹安装提示词”的伪操作。

## 旧项目迁移

先进行零写入预检：

```powershell
ai-toolops migrate --dry-run
```

正式迁移会把旧 `.ai-toolops` 备份到机器级 migrations 目录，再将项目转换为 policy 和 lock：

```powershell
ai-toolops migrate --yes
```

Skill 使用次数、健康缓存、项目 DNA 和重复 Agent Markdown 不迁移。需要恢复时：

```powershell
ai-toolops migrate rollback --yes
```

## 构建与验证

```powershell
npm install
npm run check
npm test
npm run build:windows
.\dist\ai-toolops.exe --version
.\dist\ai-toolops-setup.exe --help
```

Windows SEA 构建会输出：

```text
dist\ai-toolops.exe
dist\ai-toolops.exe.sha256
dist\ai-toolops-setup.exe
dist\ai-toolops-setup.exe.sha256
```

自更新必须提供本地或 HTTPS artifact 及 SHA-256：

```powershell
ai-toolops update self --source <artifact> --checksum <sha256> --dry-run
ai-toolops update self --source <artifact> --checksum <sha256> --yes
```

运行中的 EXE 不会被直接覆盖；PowerShell helper 会等待当前进程退出，备份旧版本、替换、运行版本检查，并在失败时恢复。

## 安全边界

- 本地优先，不上传项目或工具信息。
- 不默认后台扫描或更新。
- 便携版不修改 PATH；安装器只在用户确认后修改用户 PATH。
- 不自动修改 Agent 全局配置。
- 不复制 Agent 凭据和登录状态。
- 不加载任意第三方可执行 Provider。
- `context` 是协作式约束，不是硬权限控制。
