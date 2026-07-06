# AI ToolOps Manager v0.1.13 设计审查与修复说明

## 问题

v0.1.12 在 Windows 下修复了 setup 阶段的 `C:\Program` 路径拆分问题，但 `npm link` 阶段仍直接 `spawnSync("npm.cmd")`。部分 Windows / Node 组合会返回：

```text
spawnSync npm.cmd EINVAL
```

## 修复

Windows 下改为通过系统命令解释器执行 npm link：

```text
cmd.exe /d /s /c "npm link"
```

setup 阶段继续使用当前 Node 可执行文件直接执行 `bin/ai-toolops.js`，避免 shell 拼接导致 `C:\Program Files` 被拆分。

## 验证

- `node --check scripts/install-local.js`
- `npm run check`
- Linux/macOS 路径仍走 `npm link` 直连逻辑。
- Windows 路径空格问题通过脚本策略修复。
