import { spawnSync } from 'node:child_process'
import { cwdPath, exists, timestamp } from '../utils.js'
import { getSlotTools, getSlotType, isPrioritySlot, normalizeEquipment } from './equipmentModel.js'
import { WORKFLOW_STAGES, normalizeWorkflowStage } from './workflow.js'

function add(checks, level, code, message, extra = {}) {
  checks.push({ level, code, message, ...extra })
}

function commandExists(command) {
  const probe = process.platform === 'win32' ? 'where' : 'command'
  const args = process.platform === 'win32' ? [command] : ['-v', command]
  const result = spawnSync(probe, args, { shell: process.platform !== 'win32', stdio: 'ignore' })
  return result.status === 0
}

function getToolRuntimeStatus(toolName, tool = {}) {
  if (!toolName) return { status: 'empty', usable: false, verified: true }

  if (tool.status === 'project-provided' || tool.status === 'project_provided') {
    return { status: 'project_provided', usable: true, verified: true }
  }
  if (tool.status === 'built-in' || tool.status === 'built_in') {
    return { status: 'built_in', usable: true, verified: true }
  }
  if (tool.status === 'user-installed' || tool.status === 'installed') {
    return { status: 'installed', usable: true, verified: false }
  }

  if (toolName === 'rg') {
    const usable = commandExists('rg') || commandExists('ripgrep')
    return { status: usable ? 'installed' : 'configured_not_installed', usable, verified: true }
  }

  if (toolName === 'semble') {
    const usable = commandExists('semble')
    return { status: usable ? 'installed' : 'recommended_not_installed', usable, verified: true }
  }

  if (toolName === 'codebase-memory-mcp') {
    const usable = commandExists('codebase-memory-mcp') || commandExists('codebase-memory')
    return { status: usable ? 'installed' : 'recommended_not_installed', usable, verified: true }
  }

  if (toolName === 'askhuman' || toolName === 'AskHuman' || toolName === 'AskHuman.exe') {
    const usable = commandExists('AskHuman.exe') || commandExists('AskHuman') || commandExists('askhuman')
    return { status: usable ? 'installed' : 'recommended_not_installed', usable, verified: true }
  }

  if (toolName === 'project-architecture-docs') {
    const usable = exists(cwdPath('architecture', 'modules.summary.yaml')) || exists(cwdPath('architecture', 'modules.yaml')) || exists(cwdPath('AGENTS.md')) || exists(cwdPath('README.md'))
    return { status: usable ? 'project_provided' : 'configured_not_installed', usable, verified: true }
  }

  if (toolName === 'package-scripts') {
    const usable = Boolean(Object.keys(tool.scripts || {}).length)
    return { status: usable ? 'project_provided' : 'configured_not_installed', usable, verified: true }
  }

  if (toolName === 'compatibility-layer' || toolName === 'codex-adapter' || toolName === 'claude-adapter' || toolName === 'roo-adapter') {
    const usable = exists(cwdPath('.ai-toolops', 'adapters.json')) || exists(cwdPath('.ai-toolops', 'adapters'))
    return { status: usable ? 'built_in' : 'configured_not_installed', usable, verified: true }
  }

  return { status: 'configured_unverified', usable: false, verified: false }
}

function statusLabel(status) {
  return {
    installed: '已安装',
    project_provided: '项目内置',
    built_in: '内置适配',
    recommended_not_installed: '推荐未安装',
    configured_not_installed: '已配置未安装',
    configured_unverified: '已配置待验证',
    empty: '未装备'
  }[status] || status
}

export function runDoctor(profile, equipment, registry) {
  normalizeEquipment(equipment)
  const checks = []
  const slotSummaries = []
  const tools = registry.tools || {}
  const slots = equipment.slots || {}

  add(checks, exists(cwdPath('.ai-toolops')) ? 'info' : 'warning', 'config.root', exists(cwdPath('.ai-toolops')) ? '已发现 .ai-toolops 配置目录。' : '未发现 .ai-toolops 配置目录，建议先运行 ai-toolops init --yes。')
  add(checks, exists(cwdPath('.ai-toolops', 'equipment.json')) ? 'info' : 'warning', 'config.equipment', exists(cwdPath('.ai-toolops', 'equipment.json')) ? '已发现 equipment.json。' : '未发现 equipment.json。')
  add(checks, exists(cwdPath('.ai-toolops', 'tool-registry.json')) ? 'info' : 'warning', 'config.registry', exists(cwdPath('.ai-toolops', 'tool-registry.json')) ? '已发现 tool-registry.json。' : '未发现 tool-registry.json。')

  if (profile.packageManager && profile.packageManager !== 'unknown') add(checks, 'info', 'project.packageManager', `已识别包管理器：${profile.packageManager}。`)
  else add(checks, 'warning', 'project.packageManager', '未识别包管理器。')

  if (profile.framework?.length && !profile.framework.includes('unknown')) add(checks, 'info', 'project.framework', `已识别技术栈：${profile.framework.join(' / ')}。`)
  else add(checks, 'warning', 'project.framework', '未识别明确技术栈。')

  if (Object.keys(profile.scripts || {}).length) add(checks, 'info', 'project.scripts', `已发现 ${Object.keys(profile.scripts).length} 个 package scripts。`)
  else add(checks, 'warning', 'project.scripts', '未发现 package scripts，构建验证能力不足。')

  for (const [slotKey, slot] of Object.entries(slots)) {
    const slotTools = getSlotTools(slot)
    const slotType = getSlotType(slot)
    const prioritySlot = isPrioritySlot(slot)
    const category = slot.category || (slotType === 'project_context' ? 'project_builtin' : slotType === 'internal_adapter' ? 'agent_adapter' : 'external_tool')
    const workflowStage = normalizeWorkflowStage(slot.workflowStage, slotKey)
    const enabled = slot.enabled !== false
    const toolSummaries = []

    if (slotType === 'project_context' && category !== 'project_builtin') {
      add(checks, 'warning', `slot.${slotKey}.categoryMismatch`, `${slot.label || slotKey} 是项目上下文槽位，建议 category 使用 project_builtin。`, { slot: slotKey, slotType, category, status: 'category_mismatch' })
    }
    if (slotType === 'internal_adapter' && category !== 'agent_adapter') {
      add(checks, 'warning', `slot.${slotKey}.categoryMismatch`, `${slot.label || slotKey} 是内部适配槽位，建议 category 使用 agent_adapter。`, { slot: slotKey, slotType, category, status: 'category_mismatch' })
    }
    if (category === 'interaction_tool' && slotType !== 'exclusive_priority' && slotType !== 'additive') {
      add(checks, 'warning', `slot.${slotKey}.interactionSlotType`, `${slot.label || slotKey} 是人工确认能力，建议使用 exclusive_priority 或 additive 槽位类型。`, { slot: slotKey, slotType, category, status: 'slot_type_warning' })
    }

    if (!enabled) {
      add(checks, 'info', `slot.${slotKey}.disabled`, `${slot.label || slotKey} 已关闭，Agent 不应使用该能力槽位中的任何工具。`, { slot: slotKey, slotType, category, status: 'disabled' })
    }

    if (!slotTools.length) {
      add(checks, 'warning', `slot.${slotKey}.empty`, `槽位 ${slot.label || slotKey} 未装备工具。`, { slot: slotKey, slotType, category, status: 'empty' })
      slotSummaries.push({ slot: slotKey, label: slot.label || slotKey, slotType, category, workflowStage, relationGroup: slot.relationGroup || '', enabled, effective: null, health: 'empty', tools: [] })
      continue
    }

    let usableCount = 0
    slotTools.forEach((toolName, index) => {
      const tool = tools[toolName]
      if (!tool) {
        toolSummaries.push({ tool: toolName, order: index + 1, status: 'unknown', usable: false, verified: false, label: toolName })
        add(checks, 'error', `slot.${slotKey}.${toolName}.unknownTool`, `槽位 ${slot.label || slotKey} 包含未知工具 ${toolName}。`, { slot: slotKey, slotType, category, tool: toolName, status: 'unknown' })
        return
      }
      if (!tool.capabilities?.includes(slotKey)) {
        add(checks, 'warning', `slot.${slotKey}.${toolName}.capabilityMismatch`, `工具 ${toolName} 未声明支持槽位 ${slotKey}。`, { slot: slotKey, slotType, category, tool: toolName, status: 'capability_mismatch' })
      }

      const runtime = getToolRuntimeStatus(toolName, { ...tool, scripts: profile.scripts || {} })
      const base = { slot: slotKey, slotType, category, tool: toolName, order: index + 1, status: runtime.status }
      toolSummaries.push({ tool: toolName, label: tool.label || toolName, order: index + 1, status: runtime.status, statusLabel: statusLabel(runtime.status), usable: runtime.usable, verified: runtime.verified, type: tool.type || category })
      if (runtime.usable) usableCount += 1

      if (runtime.status === 'installed') {
        const effectiveText = prioritySlot && index === 0 && enabled ? '，当前为生效工具' : prioritySlot ? '' : '，随槽位同时启用'
        add(checks, 'info', `tool.${toolName}.installed`, `${slot.label || slotKey} 工具 ${toolName} 已安装${effectiveText}。`, base)
      } else if (runtime.status === 'project_provided') {
        add(checks, 'info', `tool.${toolName}.projectProvided`, `${slot.label || slotKey} 能力由项目内置提供：${toolName}。`, base)
      } else if (runtime.status === 'built_in') {
        add(checks, 'info', `tool.${toolName}.builtIn`, `${slot.label || slotKey} 由 AI ToolOps 内置适配提供：${toolName}。`, base)
      } else if (runtime.status === 'recommended_not_installed') {
        add(checks, 'warning', `tool.${toolName}.recommendedNotInstalled`, `${slot.label || slotKey} 已推荐 ${toolName}，但当前未检测到真实安装。`, base)
      } else if (runtime.status === 'configured_not_installed') {
        add(checks, 'warning', `tool.${toolName}.configuredNotInstalled`, `${slot.label || slotKey} 已配置 ${toolName}，但当前未检测到必要文件或命令。`, base)
      } else if (runtime.status === 'configured_unverified') {
        add(checks, 'info', `tool.${toolName}.unverified`, `${slot.label || slotKey} 已配置 ${toolName}，当前版本尚不能自动验证该工具。`, base)
      }

      if (tool.cloudUpload) add(checks, 'warning', `tool.${toolName}.cloudUpload`, `${tool.label || toolName} 存在云端上传能力，需确认后启用。`, base)
      if (tool.autoBackgroundScan) add(checks, 'warning', `tool.${toolName}.backgroundScan`, `${tool.label || toolName} 存在后台扫描，建议默认关闭。`, base)
    })

    if (usableCount > 1 && prioritySlot) add(checks, 'info', `slot.${slotKey}.multiInstalled`, `${slot.label || slotKey} 已有 ${usableCount} 个可用同类工具，排序第一的工具生效。`, { slot: slotKey, slotType, category, status: 'multi_usable' })
    if (usableCount > 1 && !prioritySlot) add(checks, 'info', `slot.${slotKey}.multiEnabled`, `${slot.label || slotKey} 已有 ${usableCount} 个可用项，该槽位不是互斥槽位，可同时发挥作用。`, { slot: slotKey, slotType, category, status: 'multi_enabled' })
    if (slot.loadLevel === 'L2' && slot.autoLoad === true) add(checks, 'warning', `slot.${slotKey}.heavyAutoLoad`, `${slot.label || slotKey} 是重型能力，不建议自动加载。`, { slot: slotKey, slotType, category, status: 'heavy_auto_load' })

    const effective = enabled ? (prioritySlot ? (slotTools[0] || null) : slotTools) : null
    const unavailableStatuses = new Set(['recommended_not_installed', 'configured_not_installed', 'unknown'])
    const availableTools = toolSummaries.filter((item) => item.usable)
    const health = !enabled ? 'disabled' : availableTools.length ? 'available' : toolSummaries.every((item) => unavailableStatuses.has(item.status)) ? 'unavailable' : 'configured'
    slotSummaries.push({ slot: slotKey, label: slot.label || slotKey, slotType, category, workflowStage, relationGroup: slot.relationGroup || '', enabled, priority: prioritySlot, effective, health, tools: toolSummaries })
  }

  if (!slots.agent_compatibility) add(checks, 'warning', 'slot.agent_compatibility.missing', '未发现 Agent 兼容层槽位，换 Agent 时可能无法复用统一规则。')
  else if (slots.agent_compatibility.slotType !== 'internal_adapter') add(checks, 'warning', 'slot.agent_compatibility.type', 'agent_compatibility 应为 internal_adapter，只负责规则生成和 Agent 适配，不应作为普通工具槽位。')
  if (slots.agent_adapter) add(checks, 'warning', 'slot.agent_adapter.deprecated', '发现旧 agent_adapter 槽位，建议迁移为 agent_compatibility 与 human_confirmation 两个槽位。')

  if (!profile.agents?.length) add(checks, 'info', 'project.agents.none', '未发现 Agent 规则文件，可按需生成 AGENTS.md / CLAUDE.md / Roo 配置。')
  else add(checks, 'info', 'project.agents.detected', `已发现 ${profile.agents.length} 个 Agent/规则入口。`)

  if (!profile.architecture?.length) add(checks, 'info', 'project.architecture.none', '未发现架构索引，建议为中大型项目补充项目画像或模块索引。')
  else add(checks, 'info', 'project.architecture.detected', `已发现 ${profile.architecture.length} 个架构入口。`)

  const summary = {
    errors: checks.filter((item) => item.level === 'error').length,
    warnings: checks.filter((item) => item.level === 'warning').length,
    info: checks.filter((item) => item.level === 'info').length
  }
  const statusCounts = {}
  for (const item of slotSummaries.flatMap((slot) => slot.tools || [])) {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1
  }

  return {
    generatedAt: timestamp(),
    project: profile.name,
    summary: { ...summary, statusCounts },
    slots: slotSummaries,
    checks,
    legend: {
      statuses: {
        installed: '已安装外部工具',
        project_provided: '项目内置能力',
        built_in: 'AI ToolOps 内置适配',
        recommended_not_installed: '推荐但未安装',
        configured_not_installed: '已配置但不可用',
        configured_unverified: '已配置但未验证',
        disabled: '槽位已关闭'
      },
      slotTypes: {
        exclusive_priority: '同类互斥，排序第一生效',
        additive: '可同时启用多个项',
        project_context: '项目内置上下文',
        internal_adapter: 'AI ToolOps 内置适配层'
      },
      categories: {
        external_tool: '外部工具',
        project_builtin: '项目内置能力',
        agent_adapter: 'Agent 适配',
        interaction_tool: '人工确认'
      },
      workflowStages: Object.fromEntries(WORKFLOW_STAGES.map((stage) => [stage.key, stage.label]))
    }
  }
}
