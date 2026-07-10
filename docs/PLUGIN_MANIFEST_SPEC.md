# AI ToolOps Plugin Manifest v1

插件 manifest 使用 JSON，位于：

```text
plugins/tools/<name>/manifest.json
plugins/skills/<name>/manifest.json
```

目录名应与 `name` 一致。扫描器也兼容标准 `SKILL.md`，因此普通 Codex / Claude / Roo Skill 不要求额外创建 manifest。

## Tool 必需字段

```json
{
  "$schema": "ai-toolops://plugin/tool/v1",
  "type": "tool",
  "name": "my-tool",
  "label": "My Tool",
  "capabilities": ["exact_search"],
  "category": "external_tool",
  "slotType": "exclusive_priority",
  "workflowStage": "project_retrieval",
  "detection": {
    "commands": ["my-tool"],
    "windowsCommands": ["my-tool.exe", "my-tool.cmd"],
    "files": [],
    "mcpServers": ["my-tool", "my_tool"]
  }
}
```

`detection` 是 Doctor 判断可用性的依据。`mcpServers` 用于匹配 Codex、Claude、Roo、VS Code/Cursor 常见本地 MCP 配置中的服务名，只读取服务名和配置来源，不读取 `command`、`args`、`env` 或密钥值。只有注册状态、没有检测契约的工具会显示为“已配置待验证”，不会冒充已安装。

## Skill 可选 manifest

```json
{
  "$schema": "ai-toolops://plugin/skill/v1",
  "type": "skill",
  "name": "my-skill",
  "label": "My Skill",
  "description": "用途说明",
  "workflowStage": "execution",
  "requiredTools": [],
  "recommendedTools": [],
  "promptFile": ".codex/skills/my-skill/SKILL.md",
  "enabled": true
}
```

manifest 用于补充工作流、工具依赖和展示元数据；实际安装发现以 `SKILL.md` 为准。重名时项目级 Skill 优先于用户级、插件缓存和工具包内置来源，所有检测来源仍记录在 `sources` 中。

## 状态与安全

- `.ai-toolops/plugin-registry.json` 是扫描产物。
- `.ai-toolops/skills.json` 保存启停选择。
- 使用 `ai-toolops skill scan|enable|disable` 修改状态，不手改生成 JSON。
- 扫描仅遍历白名单 Skill 根目录，跳过符号链接、`.git`、`node_modules`、构建与覆盖率目录。
- 不联网、不上传、不后台常驻扫描。
