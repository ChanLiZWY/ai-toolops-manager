import { getEffectiveTool, getSlotTools, getSlotType, isPrioritySlot, normalizeEquipment } from './equipmentModel.js'
import { WORKFLOW_STAGES, normalizeWorkflowStage, workflowStageLabel } from './workflow.js'
import { timestamp } from '../utils.js'
import { normalizeAdapters, enabledAdapters } from './adapterConfig.js'
import { renderGeneratedAgentFile } from '../adapters/agentAdapters.js'

const SLOT_TYPE_TEXT = {
  exclusive_priority: '同类互斥，排序第一项生效',
  additive: '可同时启用多个项',
  project_context: '项目内置上下文，不是外部工具',
  internal_adapter: 'AI ToolOps 内置适配层'
}

const CATEGORY_TEXT = {
  external_tool: '外部工具',
  project_builtin: '项目内置能力',
  agent_adapter: 'Agent 适配',
  interaction_tool: '人工确认'
}

const STATUS_TEXT = {
  installed: '已安装',
  project_provided: '项目内置',
  built_in: '内置适配',
  recommended_not_installed: '推荐未安装',
  configured_not_installed: '已配置未安装',
  configured_unverified: '已配置待验证',
  unknown: '未知工具'
}

const FILE_LOOKUP_RULES = [
  '目标文件明确、IDE 已定位、或用户已点名文件时，直接查看该文件。',
  '已知组件/依赖关系明确时，直接查看相关文件；跨文件阅读不等于跨文件检索。',
  '只有入口不明确、调用链不明确、确实需要在未知文件中定位实现/调用/影响面时，跨文件检索才优先用 Semble；Semble 无结果再用 rg 兜底。'
]

const ASKHUMAN_RULES = [
  '需要询问用户时，必须通过 Shell 调用 `AskHuman.exe`，不要在普通回复里提问；调用前先运行 `AskHuman.exe --agent-help`，工具超时设为 24 小时（`86400000 ms`）。',
  '执行需求时，先自行阅读代码、文档、配置、接口、测试或运行命令确认信息；只有问题会影响实现范围、数据来源、交互行为、接口契约、验收标准或高风险操作时，才用 AskHuman 确认。',
  '提问可汇总，每次最多 3 个关键问题；每题提供 2-3 个选项；有推荐项时用 `-o!` 标出，并用一句话说明理由。',
  '小改动、明确修复、普通状态同步、可安全默认处理的问题，不要打断用户。',
  '结束本次请求前，必须用 `AskHuman.exe` 请求反馈；只有用户明确选择结束/不继续时，才发送最终总结。'
]

const STAGE_RULE_FILE = {
  agent_rules: 'agent-rules.md',
  prompt_intake: 'prompt-intake.md',
  project_context: 'project-context.md',
  project_retrieval: 'project-retrieval.md',
  thinking_strategy: 'thinking-strategy.md',
  planning: 'planning.md',
  execution: 'execution.md',
  validation: 'validation.md',
  feedback: 'feedback.md'
}

export function generatePolicyOutputs(profile, equipment, registry, health, adapterConfig) {
  normalizeEquipment(equipment)
  const adapters = normalizeAdapters(adapterConfig)
  const context = buildPolicyContext(profile, equipment, registry, health, adapters)
  const ruleFiles = renderRuleFiles(context)
  return {
    effectivePolicy: renderEffectivePolicy(context),
    agentRules: renderAgentRules(context),
    codexRules: renderGeneratedAgentFile(profile, equipment, adapters, 'codex') || renderAgentSpecificRules(context, 'Codex'),
    claudeRules: renderGeneratedAgentFile(profile, equipment, adapters, 'claude') || renderAgentSpecificRules(context, 'Claude Code'),
    rooRules: renderGeneratedAgentFile(profile, equipment, adapters, 'roo') || renderAgentSpecificRules(context, 'Roo Code'),
    ruleFiles
  }
}

export function renderAgentRulesInclude() {
  return `## AI ToolOps 入口

如果项目存在 \`.ai-toolops/\`，Agent 先读取：

- \`.ai-toolops/generated/AGENTS.toolops.md\`

它是工具规则索引，不是业务上下文。详细规则按需读取，不要在普通任务中一次性加载所有 ToolOps 文件。

按需加载原则：

- 需要判断工具启用、禁用、优先级或可用性时，读取 \`.ai-toolops/effective-policy.md\`。
- 需要项目检索、Semble / rg / 直接读文件策略时，读取 \`.ai-toolops/generated/rules/project-retrieval.md\`。
- 需要人工确认、提问或结束反馈时，读取 \`.ai-toolops/generated/rules/feedback.md\`。
- 需要新增、注册、启用、禁用或排序工具时，使用 \`ai-toolops\` 命令；禁止手动修改 \`.ai-toolops/*.json\`。
`
}

function buildPolicyContext(profile, equipment, registry, health, adapters) {
  const slotHealth = new Map((health?.slots || []).map((slot) => [slot.slot, slot]))
  const slots = Object.entries(equipment.slots || {}).map(([slotKey, slot]) => {
    const tools = getSlotTools(slot)
    const healthSlot = slotHealth.get(slotKey)
    const toolStatus = new Map((healthSlot?.tools || []).map((tool) => [tool.tool, tool]))
    const slotType = getSlotType(slot)
    const priority = isPrioritySlot(slot)
    const enabled = slot.enabled !== false
    const effective = getEffectiveTool(slot)
    const workflowStage = normalizeWorkflowStage(slot.workflowStage, slotKey)
    return {
      key: slotKey,
      label: slot.label || slotKey,
      workflowStage,
      workflowStageText: workflowStageLabel(workflowStage),
      relationGroup: slot.relationGroup || '',
      slotType,
      slotTypeText: SLOT_TYPE_TEXT[slotType] || slotType,
      category: slot.category || 'external_tool',
      categoryText: CATEGORY_TEXT[slot.category] || slot.category || '外部工具',
      priority,
      enabled,
      effective,
      fallback: slot.fallback || [],
      loadLevel: slot.loadLevel || 'L1',
      autoLoad: slot.autoLoad,
      health: healthSlot?.health || slot.health || 'unknown',
      tools: tools.map((toolName, index) => {
        const registryTool = registry.tools?.[toolName] || {}
        const runtime = toolStatus.get(toolName) || {}
        return {
          name: toolName,
          label: registryTool.label || runtime.label || toolName,
          order: index + 1,
          status: runtime.status || registryTool.status || 'configured_unverified',
          statusText: STATUS_TEXT[runtime.status] || runtime.statusLabel || runtime.status || registryTool.status || '已配置',
          usable: Boolean(runtime.usable),
          type: registryTool.type || runtime.type || slot.category || 'external_tool',
          installHint: registryTool.installHint || '',
          useWhen: registryTool.useWhen || [],
          avoidWhen: registryTool.avoidWhen || []
        }
      })
    }
  })
  const workflow = WORKFLOW_STAGES.map((stage) => ({
    ...stage,
    ruleFile: STAGE_RULE_FILE[stage.key] || `${stage.key}.md`,
    slots: slots.filter((slot) => slot.workflowStage === stage.key)
  })).filter((stage) => stage.slots.length)
  return { generatedAt: timestamp(), profile, equipment, registry, health, adapters, slots, workflow }
}

function renderEffectivePolicy(ctx) {
  const workflowBlocks = ctx.workflow.map(renderWorkflowStage).join('\n\n') || '暂无可显示流程阶段。'
  const slotBlocks = ctx.slots.map(renderEffectiveSlot).join('\n\n') || '暂无槽位。'
  return `# AI ToolOps Effective Policy

生成时间：${ctx.generatedAt}
项目：${ctx.profile.name || 'unknown'}

本文件由 AI ToolOps Manager 自动生成，用于在需要时判断当前有效能力、禁用能力、工具优先级和工具可用性。不要手动编辑本文件；如需调整，请使用 \`ai-toolops\` 命令修改装备配置后重新生成。

## 使用方式

- 常规任务先读 \`.ai-toolops/generated/AGENTS.toolops.md\`，不要默认加载本文件全文。
- 只有需要判断工具是否可用、槽位是否启用、排序第一项是否生效、fallback 如何处理时，再读取本文件。
- 阶段细则优先读取 \`.ai-toolops/generated/rules/*.md\` 中的对应文件。

## 总规则

- Agent 必须先判断任务处于哪个流程阶段，再判断需要哪个能力槽位。
- 相似或互补能力放在同一 \`workflowStage\` 下，按条件使用，不按工具名随意调用。
- \`enabled=false\` 的槽位不得使用，即使工具在本机或 Agent 环境中可用。
- \`exclusive_priority\` 槽位只允许使用排序第一项；后续工具只是备用或候选。
- \`project_context\` 槽位是项目内置上下文，不需要安装外部工具。
- \`internal_adapter\` 槽位是 AI ToolOps 内置适配层，不等同于普通工具。
- 不允许直接手改 \`.ai-toolops/*.json\`；只能通过 \`ai-toolops\` 命令调整配置。
- 推荐未安装或不可用的工具，不得被 Agent 当作可调用工具。

## Agent 兼容层

${renderAdapterPolicy(ctx)}

## Agent 通用执行流程

${workflowBlocks}

## 当前有效能力矩阵

${slotBlocks}
`
}

function renderAdapterPolicy(ctx) {
  const rows = enabledAdapters(ctx.adapters).map((adapter) => `- ${adapter.label} (${adapter.id})：${adapter.generatedFile}；入口：${adapter.entryFiles.join('、') || '手动引用'}；工具：${adapter.tool}`).join('\n')
  const disabled = Object.values(ctx.adapters.adapters || {}).filter((adapter) => adapter.enabled === false).map((adapter) => `- ${adapter.label} (${adapter.id})`).join('\n')
  return `agent_compatibility 是内部适配层，不是普通外部工具。它根据 ToolOps 配置生成各 Agent 可读规则，不维护独立工具细则。\n\n启用适配器：\n${rows || '- 无'}\n\n关闭适配器：\n${disabled || '- 无'}`
}

function renderWorkflowStage(stage) {
  const lines = stage.slots.map((slot) => `- ${slot.label} (${slot.key})：${slot.enabled ? '启用' : '关闭'}；当前有效：${slot.enabled ? formatEffectiveWithAvailability(slot) : '无'}；类型：${slot.slotType}`).join('\n')
  return `### ${stage.label} / ${stage.key}

${stage.description}

按需细则：\`.ai-toolops/generated/rules/${stage.ruleFile}\`

${lines}`
}

function renderEffectiveSlot(slot) {
  const enabledText = slot.enabled ? '启用' : '关闭'
  const effectiveText = slot.enabled ? formatEffectiveWithAvailability(slot) : '无，槽位已关闭'
  const toolsText = slot.tools.length ? slot.tools.map((tool) => renderToolLine(tool)).join('\n') : '  - 无'
  const fallbackText = slot.fallback.length ? slot.fallback.join(', ') : '无'
  const relationText = slot.relationGroup || '未指定'
  const useRules = renderUseRules(slot)
  return `### ${slot.label} / ${slot.key}

- 流程阶段：${slot.workflowStageText} (${slot.workflowStage})
- 互补分组：${relationText}
- 状态：${enabledText}
- 类型：${slot.slotType}（${slot.slotTypeText}）
- 分组：${slot.categoryText}
- 当前有效：${effectiveText}
- 加载策略：${slot.loadLevel} / ${slot.autoLoad}
- fallback：${fallbackText}
- 健康状态：${slot.health}

装备列表：
${toolsText}

使用规则：
${useRules}`
}

function renderToolLine(tool) {
  const useWhen = tool.useWhen?.length ? `；适用：${tool.useWhen.join(' / ')}` : ''
  const avoidWhen = tool.avoidWhen?.length ? `；避免：${tool.avoidWhen.join(' / ')}` : ''
  return `  - ${tool.order}. ${tool.label} (${tool.name})：${tool.statusText}${tool.usable ? '，可用' : '，不可用或待验证'}${useWhen}${avoidWhen}`
}

function renderUseRules(slot) {
  if (!slot.enabled) return '- 不得使用该能力槽位中的任何工具。'
  if (slot.key === 'semantic_search' || slot.key === 'exact_search') return FILE_LOOKUP_RULES.map((item) => `- ${item}`).join('\n')
  if (slot.key === 'human_confirmation' || slot.category === 'interaction_tool') return ASKHUMAN_RULES.map((item) => `- ${item}`).join('\n')
  if (slot.slotType === 'project_context') return '- 优先读取项目内置文件、脚本或架构入口；不要把该能力理解成外部工具安装任务。'
  if (slot.slotType === 'internal_adapter') return '- 只用于生成或同步 Agent 规则/配置；不要把它当成业务开发工具。'
  if (slot.priority) {
    const first = slot.tools[0]
    if (!first) return '- 当前没有装备工具，不得使用该能力。'
    if (!first.usable) return `- 排序第一项是 ${first.name}，但当前状态为“${first.statusText}”。在安装或调整排序前，不得调用该工具。`
    return `- 只能使用排序第一项：${first.name}。需要换工具时，先运行 \`ai-toolops reorder-tools ${slot.key} <tool...>\`。`
  }
  return '- 可同时使用已启用工具，但仍需遵守本地优先、不默认上传、不默认后台扫描策略。'
}

function renderAgentRules(ctx) {
  const workflowSummary = ctx.workflow.map((stage) => `- ${stage.label}：${stage.slots.map((slot) => `${slot.label}(${slot.key})`).join('、')}；细则：\`.ai-toolops/generated/rules/${stage.ruleFile}\``).join('\n')
  const disabled = ctx.slots.filter((slot) => !slot.enabled).map((slot) => `- ${slot.label} (${slot.key})`).join('\n')
  return `# AGENTS ToolOps Rules

生成时间：${ctx.generatedAt}
项目：${ctx.profile.name || 'unknown'}

本文件由 AI ToolOps Manager 自动生成，是 ToolOps 的轻量索引。不要手动编辑本文件。

## 读取原则

1. 本文件是常驻入口；详细规则按需读取，不要在普通任务中一次性加载全部 ToolOps 文件。
2. 需要判断工具启用、禁用、优先级、可用性或 fallback 时，读取 \`.ai-toolops/effective-policy.md\`。
3. 需要某一流程阶段的细则时，只读取下方对应的 \`.ai-toolops/generated/rules/*.md\`。
4. 禁止直接修改 \`.ai-toolops/*.json\`；新增、接入、启用、禁用、排序工具必须使用 \`ai-toolops\` 命令。
5. \`enabled=false\`、未安装、不可用、Doctor 标为推荐未安装的工具，不得被当作可调用工具。

## 流程阶段索引

${workflowSummary || '暂无流程阶段。'}

## 快速禁用清单

${disabled || '当前无关闭槽位。'}

## 常用按需文件

- 项目检索 / Semble / rg：\`.ai-toolops/generated/rules/project-retrieval.md\`
- 人工确认 / AskHuman / 结束反馈：\`.ai-toolops/generated/rules/feedback.md\`
- 当前有效能力矩阵：\`.ai-toolops/effective-policy.md\`
- Agent 专用规则：按 \`.ai-toolops/adapters.json\` 中启用的适配器生成；常用文件为 \`.ai-toolops/generated/CODEX.toolops.md\`、\`.ai-toolops/generated/CLAUDE.toolops.md\`、\`.ai-toolops/generated/ROO.toolops.md\`

## 常用命令

- \`ai-toolops doctor\`：检查装备与生成派生规则。
- \`ai-toolops ui\`：打开本地装备栏。
- \`ai-toolops toggle <slot> on|off\`：启用或禁用能力槽位。
- \`ai-toolops reorder-tools <slot> <tool...>\`：调整互斥槽位工具优先级。
- \`ai-toolops register-tool <slot> <tool> --label <名称>\`：注册工具。
- \`ai-toolops equip <slot> <tool>\`：装备工具。
- \`ai-toolops create-slot <slot> --label <名称> --workflow-stage <阶段>\`：新增能力槽位。
`
}

function renderAgentSpecificRules(ctx, agentName) {
  return `${renderAgentRules(ctx)}
## ${agentName} 使用建议

- 启动任务时先读本文件索引；只有需要工具决策时再读 \`.ai-toolops/effective-policy.md\`。
- 需要修改规则时，不要直接编辑生成文件；先改 ToolOps 配置，再运行 \`ai-toolops doctor\` 或 \`ai-toolops generate-agent-rules\`。
- 若该 Agent 有独立配置文件，只引用本文件或同步生成片段，不复制粘贴过期规则。
`
}

function renderRuleFiles(ctx) {
  const files = {
    'index.md': renderRulesIndex(ctx)
  }
  for (const stage of ctx.workflow) {
    files[stage.ruleFile] = renderStageRule(stage)
  }
  if (!files['project-retrieval.md']) files['project-retrieval.md'] = renderStandaloneProjectRetrievalRule(ctx)
  if (!files['feedback.md']) files['feedback.md'] = renderStandaloneFeedbackRule(ctx)
  return files
}

function renderRulesIndex(ctx) {
  const items = ctx.workflow.map((stage) => `- ${stage.label} / ${stage.key}：\`.ai-toolops/generated/rules/${stage.ruleFile}\``).join('\n')
  return `# AI ToolOps Rules Index

生成时间：${ctx.generatedAt}

本目录是按需加载规则目录。普通任务先读 \`.ai-toolops/generated/AGENTS.toolops.md\`；只有命中具体场景时，再读这里的细则。

${items || '暂无流程阶段规则。'}
`
}

function renderStageRule(stage) {
  const slots = stage.slots.map(renderStageSlot).join('\n\n') || '暂无槽位。'
  const extra = renderStageExtra(stage.key)
  return `# ${stage.label} / ${stage.key}

${stage.description}

## 适用时机

只有任务进入该流程阶段，或需要判断该阶段工具是否可用、如何选择时，才读取本文件。

${extra}

## 槽位

${slots}
`
}

function renderStageSlot(slot) {
  const effective = slot.enabled ? formatEffectiveWithAvailability(slot) : '无，槽位已关闭'
  const tools = slot.tools.length ? slot.tools.map((tool) => `- ${tool.order}. ${tool.label} (${tool.name})：${tool.statusText}${tool.usable ? '，可用' : '，不可用或待验证'}`).join('\n') : '- 无'
  return `### ${slot.label} / ${slot.key}

- 状态：${slot.enabled ? '启用' : '关闭'}
- 类型：${slot.slotType}（${slot.slotTypeText}）
- 当前有效：${effective}
- 互补分组：${slot.relationGroup || '未指定'}
- fallback：${slot.fallback.length ? slot.fallback.join(', ') : '无'}

${tools}

${renderUseRules(slot)}`
}

function renderStageExtra(stageKey) {
  if (stageKey === 'project_retrieval') {
    return `## 文件查找策略

${FILE_LOOKUP_RULES.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
  }
  if (stageKey === 'feedback') {
    return `## AskHuman 使用规则

${ASKHUMAN_RULES.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
  }
  if (stageKey === 'project_context') {
    return `## 上下文读取原则

1. 只读取当前任务路由命中的项目文档、架构文档或配置入口。
2. 项目内置上下文不是外部工具，不需要安装。
3. 未命中路由时，不扩大读取范围。`
  }
  if (stageKey === 'validation') {
    return `## 验证原则

1. 优先使用项目已有 lint / test / build / typecheck 脚本。
2. 小改动只做必要验证，不启动无关全量流程。
3. 缺少脚本时说明无法验证，不伪造结果。`
  }
  return ''
}

function renderStandaloneProjectRetrievalRule(ctx) {
  return `# 项目检索 / project_retrieval

当前没有项目检索槽位，但仍保留通用文件查找策略。

${FILE_LOOKUP_RULES.map((item, index) => `${index + 1}. ${item}`).join('\n')}
`
}

function renderStandaloneFeedbackRule(ctx) {
  return `# 反馈 / 人工确认 / feedback

当前没有人工确认槽位，但仍保留通用 AskHuman 使用策略。

${ASKHUMAN_RULES.map((item, index) => `${index + 1}. ${item}`).join('\n')}
`
}

function formatEffectiveWithAvailability(slot) {
  if (Array.isArray(slot.effective)) {
    const names = slot.effective.map((name) => {
      const tool = slot.tools.find((item) => item.name === name)
      if (!tool) return name
      return tool.usable ? name : `${name}（不可用，不得调用）`
    })
    return names.length ? names.join(' + ') : '无'
  }
  if (!slot.effective) return '无'
  const tool = slot.tools.find((item) => item.name === slot.effective)
  if (!tool) return slot.effective
  return tool.usable ? slot.effective : `${slot.effective}（不可用，不得调用）`
}

function formatEffective(value) {
  if (Array.isArray(value)) return value.length ? value.join(' + ') : '无'
  return value || '无'
}
