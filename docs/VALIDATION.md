# AI ToolOps Manager Windows v1 验收

本文件只覆盖当前 v1 代码。历史 `equipment`、插件目录扫描、Skill 次数、规则 Markdown 生成和拖拽排序不再属于产品验收范围。

## 自动验证

在 Windows 10/11 x64、Node 23 开发环境中运行：

```powershell
npm ci
npm run check
npm test
npm run build:windows
npm run smoke:windows
```

预期：

- 所有语法检查和 v1 测试通过。
- `dist\ai-toolops.exe`、`dist\ai-toolops-setup.exe` 及各自 SHA-256 文件生成。
- 独立程序无需外部 Node 即可执行 `--version`、初始化项目、启动 UI 并读取 `/api/state`。
- 安装器在隔离的中文/空格路径中完成安装、重复升级、快捷方式、卸载注册和完整卸载。

## 手工验收

### 用户级安装与卸载

```powershell
.\dist\ai-toolops-setup.exe
ai-toolops --version
```

验收安装目录位于 `%LOCALAPPDATA%\Programs\ai-toolops`，开始菜单存在 AI ToolOps Manager，Windows“已安装的应用”存在卸载项。安装器经用户确认后加入用户 PATH；桌面快捷方式由用户选择。

### 项目状态

```powershell
ai-toolops init --project "C:\临时项目\带 空格"
ai-toolops context --project "C:\临时项目\带 空格" --agent auto
ai-toolops doctor --project "C:\临时项目\带 空格" --json
```

项目稳定配置只能包含 `.ai-toolops\policy.yaml` 和 `.ai-toolops\toolops.lock.json`，不得出现绝对路径、健康缓存、Windows 用户名或凭据。

### 工具生命周期

```powershell
ai-toolops install rg --project . --dry-run
ai-toolops install rg --project . --yes
ai-toolops doctor --project .
ai-toolops uninstall rg --project . --dry-run
```

每次变更先返回 ActionPlan；真实执行产生电脑级 receipt。重复安装必须幂等，执行失败不得把库存标记为已安装。

### 跨项目与新电脑恢复

在两个项目中声明同一能力，确认第二个项目复用 `%LOCALAPPDATA%\ai-toolops` 中的托管工具。复制项目的 `policy.yaml` 与 `toolops.lock.json` 到另一台 Windows 电脑后执行：

```powershell
ai-toolops bootstrap --locked --project . --dry-run
ai-toolops bootstrap --locked --project . --yes
```

### Agent 隔离

```powershell
ai-toolops agent detect --project .
ai-toolops agent bind codex --project . --dry-run
ai-toolops agent bind codex --project . --yes
ai-toolops agent status codex --project .
```

绑定记录只属于指定 Agent。未知 Agent 必须回退 generic，generic 不得继承 Codex、Claude 或 Roo 的专属 MCP。

### 本地 UI

```powershell
ai-toolops ui --project .
```

检查总览、能力、电脑库存、变更回执和设置页面。所有变更必须先展示计划再确认，按钮必须调用真实应用服务，不得用提示词或界面状态冒充安装。

从开始菜单启动后，使用顶部项目入口选择一个带中文和空格的已初始化项目，再切换至另一个最近项目。确认当前路径、能力和 Doctor 状态随项目切换；未初始化目录必须显示恢复说明，不能静默切换。

## 发布前实机矩阵

至少记录：

| 环境 | 普通用户安装 | 中文/空格路径 | Defender | 文件占用恢复 | 独立程序 |
|---|---:|---:|---:|---:|---:|
| Windows 10 x64 | 待实机记录 | 待实机记录 | 待实机记录 | 待实机记录 | 待实机记录 |
| Windows 11 Pro x64 build 26200（当前开发机） | 通过（当前账号） | 自动测试通过 | 待发布环境记录 | 事务测试通过，待真实外部占用记录 | 通过 |

未执行的实机项不得标记为通过。
