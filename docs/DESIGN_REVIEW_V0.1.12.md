# AI ToolOps Manager v0.1.12 设计审查与修复说明

## 背景

v0.1.11 新增了 `npm run install:local -- --project <path> --ui`，用于解压新版工具后一步完成 `npm link` 和目标项目 `ai-toolops setup`。

在 Windows 环境下，如果 Node 安装路径或工作目录包含空格，例如：

```text
C:\Program Files\nodejs\node.exe
D:\AI Agent\AI WorkSpace\ai-toolops-manager
```

旧版脚本使用 shell 执行命令，可能把 `C:\Program Files` 错误拆成 `C:\Program`，导致：

```text
'C:\Program' 不是内部或外部命令，也不是可运行的程序或批处理文件。
```

## 修复

- `scripts/install-local.js` 改为 `shell: false`。
- Windows 下 `npm link` 直接调用 `npm.cmd`。
- setup 阶段直接使用 `process.execPath` 执行 `bin/ai-toolops.js`，不通过 shell 拼接命令。
- setup 阶段显式传入 `--project <目标项目路径>`，避免依赖 cwd 推断。

## 使用方式

```bash
npm run install:local -- --project ../ClothesSuit --ui
```

或绝对路径：

```bash
npm run install:local -- --project "D:\AI Agent\AI WorkSpace\ClothesSuit" --ui
```

## 说明

`npm warn Unknown user config "home"` 是用户 npm 配置中的未知配置项告警，不影响 AI ToolOps 安装与 setup。后续如果想消除该提示，可以检查用户级 `.npmrc`，删除不受 npm 支持的 `home` 配置。
