# AI ToolOps Manager v0.1.11 设计审查与迭代说明

## 目标

本版本解决两个体验问题：

1. UI 长时间阅读不够舒适，Doctor 检查明细默认占用过多空间。
2. 本地 zip 升级流程繁琐：解压覆盖、`npm link`、进入项目执行多条初始化命令。

## UI 优化

- 顶部增加白天 / 夜晚模式切换，并使用 `localStorage` 记忆。
- 夜晚模式降低纯黑对比，使用蓝灰底色；白天模式使用偏暖护眼色。
- Doctor 明细默认折叠，仅保留摘要指标：错误、警告、提示、检查项数量。
- 检查明细展开后保留按 level 着色的行式列表，方便定位 warning / error。
- 调整整体字号、卡片边距、状态 badge、卡片边框，让重点信息更容易扫描。

## 升级流程优化

新增命令：

```bash
ai-toolops setup [--project <path>] [--ui --port 4177]
```

行为：

- 当前项目未初始化时，自动执行初始化。
- 当前项目已初始化时，自动执行升级同步。
- 自动刷新 `project.profile.json`、`project-dna.json`、`equipment.json`、`tool-registry.json`、`capabilities.json`。
- 自动运行 Doctor 并刷新派生文件。
- 自动同步 `AGENTS.md` 的 AI ToolOps 管理块。
- 自动生成 UI 数据。
- 执行前创建快照，便于回滚。

新增本地安装脚本：

```bash
npm run install:local -- --project /path/to/project
```

行为：

- 在工具目录执行 `npm link`。
- 对目标项目执行 `ai-toolops setup`。
- 可追加 `--ui` 直接启动 UI。

## 使用建议

之后本地 zip 升级推荐：

```bash
# 解压新版工具包后，在工具包目录执行
npm run install:local -- --project /path/to/project
```

如果已经 link 过，只需要：

```bash
ai-toolops setup --project /path/to/project
```
