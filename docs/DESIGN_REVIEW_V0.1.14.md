# v0.1.14 自我审核：agent_compatibility 适配器层

## 审核目标

本次迭代目标是把 `agent_compatibility` 从“一个展示卡片 / 普通工具”升级为 AI ToolOps Manager 内部的适配器封装层。

## 设计结论

### 1. 规则源没有新增第三份

`agent_compatibility` 不维护独立规则源，只读取和翻译：

- `.ai-toolops/equipment.json`
- `.ai-toolops/tool-registry.json`
- `.ai-toolops/effective-policy.md`
- `.ai-toolops/generated/rules/*.md`

生成产物只作为 Agent 入口文件，不允许手动维护。

### 2. Adapter 配置独立

新增：

```text
.ai-toolops/adapters.json
```

它只描述 Codex / Claude / Roo 等适配目标是否启用、生成到哪里、入口文件是什么，不承载工具细则。

### 3. agent_compatibility 边界清晰

`agent_compatibility` 槽位现在默认装备：

```text
codex-adapter
claude-adapter
roo-adapter
```

这些工具均为 `internal_adapter`，不是外部工具，也不是 MCP。

### 4. CLI 可控

新增：

```bash
ai-toolops adapters list
ai-toolops adapters enable codex
ai-toolops adapters disable claude
ai-toolops sync-agent-rules --agent codex
```

工具相关变更仍通过 `ai-toolops` 命令完成，不直接手改 JSON。

### 5. UI 不越界

UI 只展示当前适配器启用状态和生成文件位置，不在页面中内联大量规则细节，符合按需加载原则。

## 验证结果

已执行：

```bash
npm run check
```

结果：通过。

临时项目验证：

```bash
ai-toolops setup
ai-toolops adapters list
ai-toolops adapters disable claude
ai-toolops sync-agent-rules --agent codex
node --check .ai-toolops/ui/app.js
```

结果：通过。

## 风险与非目标

- 本版本仍不是 MCP Gateway，不能系统级拦截 Agent 调用工具。
- Adapter 当前生成 Markdown 规则，不直接写入所有第三方 Agent 私有配置。
- `compatibility-layer` 仍保留在 registry 中作为旧版本兼容项，但新默认装备已改为具体 adapter 工具。
