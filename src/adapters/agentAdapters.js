import { timestamp } from '../utils.js'
import { getSlotTools, getSlotType, isPrioritySlot, normalizeEquipment } from '../core/equipmentModel.js'
import { enabledAdapters, normalizeAdapters } from '../core/adapterConfig.js'

export function generateAdapterOutputs(profile, equipment, adapterConfig, options = {}) {
  normalizeEquipment(equipment)
  const normalized = normalizeAdapters(adapterConfig)
  const target = options.agent || 'all'
  const outputs = {}
  for (const adapter of enabledAdapters(normalized, target)) {
    outputs[adapter.adapterFile.replace(/^\.ai-toolops\/adapters\//, '')] = renderAdapterRules(profile, equipment, adapter, normalized)
  }
  outputs['index.md'] = renderAdapterIndex(profile, normalized)
  return outputs
}

export function renderGeneratedAgentFile(profile, equipment, adapterConfig, adapterId) {
  const normalized = normalizeAdapters(adapterConfig)
  const adapter = normalized.adapters?.[adapterId]
  if (!adapter) return ''
  if (adapter.enabled === false) return `# AI ToolOps ${adapter.label} Adapter\n\n生成时间：${timestamp()}\n项目：${profile.name || 'unknown'}\n\n该适配器已在 \`.ai-toolops/adapters.json\` 中关闭。不要读取或使用本文件作为当前 Agent 规则。\n`
  return renderAdapterRules(profile, equipment, adapter, normalized)
}

function rowForSlot(key, slot) {
  const allTools = getSlotTools(slot)
  const slotType = getSlotType(slot)
  if (slot.enabled === false) return `- ${slot.label} (${key})：已关闭，Agent 不得使用；类型：${slotType}；已装备：${allTools.join(' > ') || '无'}`
  if (isPrioritySlot(slot)) return `- ${slot.label} (${key})：生效：${allTools[0] || '无'}；备用：${allTools.slice(1).join(' > ') || '无'}；fallback：${(slot.fallback || []).join(', ') || '无'}；类型：互斥优先级；加载：${slot.autoLoad}`
  return `- ${slot.label} (${key})：启用项：${allTools.join(' + ') || '无'}；fallback：${(slot.fallback || []).join(', ') || '无'}；类型：${slotType}；加载：${slot.autoLoad}`
}

function common(profile, equipment, adapter, config) {
  const rows = Object.entries(equipment.slots || {}).map(([key, slot]) => rowForSlot(key, slot)).join('\n')
  const enabledNames = enabledAdapters(config).map((item) => item.label).join(' / ') || '无'

  return `# AI ToolOps ${adapter.label} Adapter

生成时间：${timestamp()}
项目：${profile.name || 'unknown'}
适配器：${adapter.id}
生成文件：${adapter.generatedFile}
入口文件：${adapter.entryFiles.join('、') || '按项目手动引用'}

本文件由 \`agent_compatibility\` 内部适配层生成。它不是独立规则源，不要手动编辑。

## 适配器职责

- 读取 AI ToolOps 的统一配置和有效策略。
- 把统一策略转换成 ${adapter.label} 更容易读取的 Markdown 规则。
- 不维护单独工具细则；工具细则以 \`.ai-toolops/equipment.json\`、\`.ai-toolops/effective-policy.md\` 和 \`.ai-toolops/generated/rules/*.md\` 为准。
- 当前启用适配目标：${enabledNames}。

## 工具选择原则

- Agent 选择能力槽位，不直接硬绑定某个工具。
- exact_search / semantic_search / code_graph / human_confirmation 这类互斥槽位：排序第一的工具生效。
- architecture_context / build_validation 这类项目上下文槽位：属于项目内置能力，不需要外部安装，不参与“第一项互斥”判断。
- agent_compatibility 是 Agent 兼容层，只负责规则/配置适配；它不应被 AskHuman 替代。
- human_confirmation 是人工确认通道，例如 AskHuman；它不负责多 Agent 规则兼容。
- 如果槽位 enabled=false，该能力关闭，Agent 不得使用该槽位工具。
- 重型工具默认不自动加载。
- 不默认上传代码，不默认后台扫描。

## 当前装备

${rows}
`
}

export function renderAdapterRules(profile, equipment, adapter, config) {
  const base = common(profile, equipment, adapter, config)
  if (adapter.id === 'codex') {
    return `${base}
## Codex 读取方式

- 项目入口优先读取 \`AGENTS.md\`。
- \`AGENTS.md\` 只保留 AI ToolOps 轻量入口；详细工具规则按需读取。
- 执行任务前不要一次性加载全部 \`.ai-toolops/generated/rules/*.md\`。
`
  }
  if (adapter.id === 'claude') {
    return `${base}
## Claude Code 读取方式

- 如项目存在 \`CLAUDE.md\`，只需要引用本文件或 \`.ai-toolops/generated/AGENTS.toolops.md\`。
- 不要复制整份 ToolOps 规则到 \`CLAUDE.md\`，避免规则漂移。
`
  }
  if (adapter.id === 'roo') {
    return `${base}
## Roo Code 读取方式

- 可把本文件映射到 Roo 规则或 mode 说明。
- mode 只表达何时进入某个流程阶段；具体工具启用、禁用和 fallback 仍由 ToolOps 生成策略判断。
`
  }
  return `${base}
## ${adapter.label} 读取方式

- 只引用统一 ToolOps 索引和按需规则文件。
- 不要在适配层复制独立工具细则。
`
}

function renderAdapterIndex(profile, config) {
  const rows = Object.values(config.adapters || {}).map((adapter) => `- ${adapter.enabled ? '启用' : '关闭'}：${adapter.label} (${adapter.id}) → ${adapter.generatedFile}`).join('\n')
  return `# AI ToolOps Agent Adapters

生成时间：${timestamp()}
项目：${profile.name || 'unknown'}

agent_compatibility 是 AI ToolOps 内部适配层。它负责把统一工具策略生成到不同 Agent 可读取的文件中，不是普通外部工具。

## 当前适配目标

${rows || '暂无适配器。'}

## 命令

- \`ai-toolops adapters list\`
- \`ai-toolops adapters enable <adapter>\`
- \`ai-toolops adapters disable <adapter>\`
- \`ai-toolops sync-agent-rules --agent codex\`
- \`ai-toolops sync-agent-rules --agent all\`
`
}
