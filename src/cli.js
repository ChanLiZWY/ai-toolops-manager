import path from 'node:path'
import { scanProject, buildProjectDna } from './scanner/projectScanner.js'
import { defaultCapabilities, defaultToolRegistry, buildEquipment } from './core/registries.js'
import { runDoctor } from './core/doctor.js'
import { createSnapshot, rollbackLatest } from './core/rollback.js'
import { generateAdapterOutputs } from './adapters/agentAdapters.js'
import { defaultAdapters, normalizeAdapters, setAdapterEnabled } from './core/adapterConfig.js'
import { generatePolicyOutputs, renderAgentRulesInclude } from './core/policyGenerator.js'
import { generateUi } from './ui/generateUi.js'
import { SLOT_TYPES, normalizeEquipment, promoteTool, setSlotTools, reorderSlotTools, getSlotTools } from './core/equipmentModel.js'
import { WORKFLOW_STAGE_KEYS, normalizeWorkflowStage, workflowStageLabel } from './core/workflow.js'
import { cwdPath, ensureDir, parseArgs, safeTimestamp, serveStatic, timestamp, writeJson, writeText, readJson, readText } from './utils.js'
import { scanToolPlugins, scanSkillPlugins, scanAndWriteRegistry, readPluginRegistry } from './plugin/scanner.js'

export async function main(args) {
  const { flags, positionals } = parseArgs(args)
  if (flags.get('project')) process.chdir(path.resolve(String(flags.get('project'))))
  const command = positionals[0] || 'help'
  switch (command) {
    case 'init': return init(flags)
    case 'scan': return scan()
    case 'doctor': return doctor(flags)
    case 'ui': return ui(flags)
    case 'rollback': return rollback()
    case 'equip': return equip(positionals[1], positionals[2])
    case 'unequip': return unequip(positionals[1])
    case 'toggle': return toggle(positionals[1], positionals[2])
    case 'reorder-tools': return reorderTools(positionals[1], positionals.slice(2))
    case 'register-tool': return registerTool(positionals[1], positionals[2], flags)
    case 'create-slot': return createSlot(positionals[1], flags)
    case 'generate-agent-rules': return generateAgentRules(flags)
    case 'sync-agent-rules': return generateAgentRules(new Map([...flags, ['apply', true]]))
    case 'setup': return setup(flags)
    case 'adapters': return adaptersCommand(positionals[1], positionals[2])
    case 'plugin': return pluginCommand(positionals[1], positionals.slice(2), flags)
    case 'skill': return skillCommand(positionals[1], positionals[2], flags)
    case 'help':
    default: return help()
  }
}

function help() {
  console.log(`AI ToolOps Manager

Commands:
  ai-toolops init [--yes]                         初始化当前项目
  ai-toolops scan                                 扫描并打印项目画像
  ai-toolops doctor                               检查装备健康状态并生成 UI 数据
  ai-toolops ui [--port 4177]                     生成并打开装备栏静态服务
  ai-toolops equip <slot> <tool>                  将工具加入槽位并置顶，第一项生效
  ai-toolops unequip <slot>                       清空能力槽位
  ai-toolops toggle <slot> on|off                 启用或禁用槽位
  ai-toolops reorder-tools <slot> <tool...>       调整同槽位工具优先级，第一项生效
  ai-toolops register-tool <slot> <tool> [--label] 注册工具
  ai-toolops create-slot <slot> --label 名称       新增能力槽位
  ai-toolops generate-agent-rules [--apply]       生成 Agent 规则与有效策略
  ai-toolops sync-agent-rules                     同步 AGENTS.md 引用块
  ai-toolops setup [--project 路径] [--ui]        一步初始化/升级
  ai-toolops adapters list|enable|disable [id]    管理 Agent 适配器
  ai-toolops plugin scan|list                     扫描/列出插件
  ai-toolops skill list|enable|disable <name>     管理 Skill
  ai-toolops rollback                             恢复最近快照
`)
}



function upgradeCapabilities(capabilities) {
  const defaults = defaultCapabilities()
  capabilities ||= defaults
  capabilities.capabilities ||= {}
  capabilities.capabilities = { ...Object.fromEntries(Object.entries(defaults.capabilities).map(([key, value]) => [key, { ...value, ...(capabilities.capabilities[key] || {}) }])), ...Object.fromEntries(Object.entries(capabilities.capabilities).filter(([key]) => !defaults.capabilities[key])) }
  if (capabilities.capabilities.agent_adapter) delete capabilities.capabilities.agent_adapter
  capabilities.capabilities.agent_compatibility = { ...defaults.capabilities.agent_compatibility, ...(capabilities.capabilities.agent_compatibility || {}) }
  capabilities.capabilities.human_confirmation = { ...defaults.capabilities.human_confirmation, ...(capabilities.capabilities.human_confirmation || {}) }
  capabilities.updatedAt = timestamp()
  return capabilities
}

function upgradeRegistry(profile, registry) {
  const defaults = defaultToolRegistry(profile)
  registry ||= defaults
  registry.tools ||= {}
  registry.tools = { ...Object.fromEntries(Object.entries(defaults.tools).map(([key, value]) => [key, { ...value, ...(registry.tools[key] || {}) }])), ...Object.fromEntries(Object.entries(registry.tools).filter(([key]) => !defaults.tools[key])) }
  if (registry.tools['compatibility-layer']) {
    registry.tools['compatibility-layer'] = { ...defaults.tools['compatibility-layer'], ...registry.tools['compatibility-layer'], capabilities: ['agent_compatibility'], type: 'internal_adapter', status: 'built-in' }
  }
  if (registry.tools['project-architecture-docs']) {
    registry.tools['project-architecture-docs'] = { ...defaults.tools['project-architecture-docs'], ...registry.tools['project-architecture-docs'], capabilities: ['architecture_context'], type: 'project_context', status: defaults.tools['project-architecture-docs'].status }
  }
  if (registry.tools['package-scripts']) {
    registry.tools['package-scripts'] = { ...defaults.tools['package-scripts'], ...registry.tools['package-scripts'], capabilities: ['build_validation'], type: 'project_context', status: defaults.tools['package-scripts'].status }
  }
  if (registry.tools.askhuman) {
    registry.tools.askhuman = { ...defaults.tools.askhuman, ...registry.tools.askhuman, capabilities: Array.from(new Set([...(registry.tools.askhuman.capabilities || []).filter((item) => item !== 'agent_adapter'), 'human_confirmation'])), type: 'interaction_tool' }
  }
  registry.updatedAt = timestamp()
  return registry
}

function writeAdapters(profile, equipment, adapterConfig, options = {}) {
  ensureDir(cwdPath('.ai-toolops', 'adapters'))
  const adapters = generateAdapterOutputs(profile, equipment, adapterConfig, options)
  for (const [file, content] of Object.entries(adapters)) writeText(cwdPath('.ai-toolops', 'adapters', file), content)
}

function writePolicyOutputs(profile, equipment, registry, health, adapterConfig) {
  const outputs = generatePolicyOutputs(profile, equipment, registry, health, adapterConfig)
  ensureDir(cwdPath('.ai-toolops', 'generated'))
  ensureDir(cwdPath('.ai-toolops', 'generated', 'rules'))
  writeText(cwdPath('.ai-toolops', 'effective-policy.md'), outputs.effectivePolicy)
  writeText(cwdPath('.ai-toolops', 'generated', 'AGENTS.toolops.md'), outputs.agentRules)
  writeText(cwdPath('.ai-toolops', 'generated', 'CODEX.toolops.md'), outputs.codexRules)
  writeText(cwdPath('.ai-toolops', 'generated', 'CLAUDE.toolops.md'), outputs.claudeRules)
  writeText(cwdPath('.ai-toolops', 'generated', 'ROO.toolops.md'), outputs.rooRules)
  for (const [file, content] of Object.entries(outputs.ruleFiles || {})) {
    writeText(cwdPath('.ai-toolops', 'generated', 'rules', file), content)
  }
}

function refreshDerived(profile, equipment, registry, adapterConfig = null, options = {}) {
  const adapters = normalizeAdapters(adapterConfig || readJson(cwdPath('.ai-toolops', 'adapters.json')) || defaultAdapters())
  writeJson(cwdPath('.ai-toolops', 'adapters.json'), adapters)
  const report = runDoctor(profile, equipment, registry)
  writeJson(cwdPath('.ai-toolops', 'health-report.json'), report)
  writeAdapters(profile, equipment, adapters, options)
  writePolicyOutputs(profile, equipment, registry, report, adapters)
  generateUi()
  return report
}


function setup(flags = new Map()) {
  const hasEquipment = Boolean(readJson(cwdPath('.ai-toolops', 'equipment.json')))
  if (!hasEquipment) {
    init(new Map([...flags, ['yes', true]]))
  } else {
    const snapshot = createSnapshot(['.ai-toolops', 'AGENTS.md', 'CLAUDE.md'])
    const profile = scanProject()
    const projectDna = buildProjectDna(profile)
    const equipment = normalizeEquipment(readJson(cwdPath('.ai-toolops', 'equipment.json')) || buildEquipment(profile))
    const registry = upgradeRegistry(profile, readJson(cwdPath('.ai-toolops', 'tool-registry.json')) || defaultToolRegistry(profile))
    const capabilities = upgradeCapabilities(readJson(cwdPath('.ai-toolops', 'capabilities.json')) || defaultCapabilities())
    const adapters = normalizeAdapters(readJson(cwdPath('.ai-toolops', 'adapters.json')) || defaultAdapters())

    writeJson(cwdPath('.ai-toolops', 'project.profile.json'), profile)
    writeJson(cwdPath('.ai-toolops', 'project-dna.json'), projectDna)
    writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
    writeJson(cwdPath('.ai-toolops', 'tool-registry.json'), registry)
    writeJson(cwdPath('.ai-toolops', 'capabilities.json'), capabilities)
    writeJson(cwdPath('.ai-toolops', 'adapters.json'), adapters)
    refreshDerived(profile, equipment, registry, adapters)
    writeJson(cwdPath('.ai-toolops', 'history', `${safeTimestamp()}.json`), { action: 'setup', snapshot })
  }

  syncAgentsMarkdown()
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
  const report = readJson(cwdPath('.ai-toolops', 'health-report.json'), { summary: {} })
  console.log(JSON.stringify({
    ok: true,
    action: hasEquipment ? 'upgrade-existing-project' : 'init-new-project',
    project: profile.name || path.basename(process.cwd()),
    generated: [
      '.ai-toolops/effective-policy.md',
      '.ai-toolops/generated/AGENTS.toolops.md',
      '.ai-toolops/generated/rules/index.md',
      '.ai-toolops/ui/index.html',
      'AGENTS.md managed block'
    ],
    warnings: report.summary?.warnings || 0,
    errors: report.summary?.errors || 0,
    next: flags.get('ui') ? 'UI server starting...' : '运行 ai-toolops ui 查看装备栏'
  }, null, 2))

  if (flags.get('ui') === true || flags.get('ui') === 'true') {
    ui(flags)
  }
}

function scan() {
  const profile = scanProject()
  console.log(JSON.stringify(profile, null, 2))
}

function init(flags) {
  const yes = flags.get('yes') === true || flags.get('y') === true
  if (!yes) {
    console.log('将生成 .ai-toolops 配置目录，不修改业务代码。使用 --yes 确认执行。')
    return
  }
  const snapshot = createSnapshot(['.ai-toolops', 'AGENTS.md', 'CLAUDE.md'])
  const profile = scanProject()
  const projectDna = buildProjectDna(profile)
  const capabilities = defaultCapabilities()
  const registry = defaultToolRegistry(profile)
  const equipment = normalizeEquipment(buildEquipment(profile))
  const adapters = defaultAdapters()

  ensureDir(cwdPath('.ai-toolops', 'adapters'))
  writeJson(cwdPath('.ai-toolops', 'project.profile.json'), profile)
  writeJson(cwdPath('.ai-toolops', 'project-dna.json'), projectDna)
  writeJson(cwdPath('.ai-toolops', 'capabilities.json'), capabilities)
  writeJson(cwdPath('.ai-toolops', 'tool-registry.json'), registry)
  writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
  writeJson(cwdPath('.ai-toolops', 'adapters.json'), adapters)
  refreshDerived(profile, equipment, registry, adapters)
  writeJson(cwdPath('.ai-toolops', 'history', `${safeTimestamp()}.json`), { action: 'init', snapshot })
  console.log(`初始化完成：.ai-toolops/\n备份目录：${snapshot}\n运行 ai-toolops doctor 查看状态，运行 ai-toolops ui 查看装备栏。`)
}

function doctor(flags = new Map()) {
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
  const equipment = normalizeEquipment(readJson(cwdPath('.ai-toolops', 'equipment.json')) || buildEquipment(profile))
  const registry = upgradeRegistry(profile, readJson(cwdPath('.ai-toolops', 'tool-registry.json')) || defaultToolRegistry(profile))
  const capabilities = upgradeCapabilities(readJson(cwdPath('.ai-toolops', 'capabilities.json')) || defaultCapabilities())
  writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
  writeJson(cwdPath('.ai-toolops', 'tool-registry.json'), registry)
  writeJson(cwdPath('.ai-toolops', 'capabilities.json'), capabilities)
  const adapterConfig = normalizeAdapters(readJson(cwdPath('.ai-toolops', 'adapters.json')) || defaultAdapters())
  const report = refreshDerived(profile, equipment, registry, adapterConfig, { agent: flags.get('agent') || 'all' })
  console.log(JSON.stringify(report, null, 2))
}

function ui(flags) {
  const outDir = generateUi()
  const port = Number(flags.get('port') || 4177)
  serveStatic(path.resolve(outDir), port)
}

function rollback() {
  const result = rollbackLatest()
  console.log(result.message)
}

function equip(slotKey, toolName) {
  if (!slotKey || !toolName) throw new Error('用法：ai-toolops equip <slot> <tool>')
  const rawEquipment = readJson(cwdPath('.ai-toolops', 'equipment.json'))
  const equipment = rawEquipment ? normalizeEquipment(rawEquipment) : null
  const registry = upgradeRegistry(readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject(), readJson(cwdPath('.ai-toolops', 'tool-registry.json')))
  if (!equipment || !registry) throw new Error('未初始化，请先运行 ai-toolops init --yes')
  if (!equipment.slots[slotKey]) throw new Error(`未知槽位：${slotKey}`)
  const tool = registry.tools?.[toolName]
  if (!tool) throw new Error(`未知工具：${toolName}。请先在 .ai-toolops/tool-registry.json 注册。`)
  if (!tool.capabilities?.includes(slotKey)) {
    throw new Error(`工具 ${toolName} 不声明支持槽位 ${slotKey}，请确认 tool-registry.json。`)
  }
  normalizeEquipment(equipment)
  promoteTool(equipment.slots[slotKey], toolName)
  equipment.slots[slotKey].health = tool.status === 'missing' ? 'missing' : 'ok'
  writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
  refreshDerived(profile, equipment, registry)
  console.log(`已装备：${slotKey} -> ${toolName}`)
}

function unequip(slotKey) {
  if (!slotKey) throw new Error('用法：ai-toolops unequip <slot>')
  const rawEquipment = readJson(cwdPath('.ai-toolops', 'equipment.json'))
  if (!rawEquipment) throw new Error('未初始化，请先运行 ai-toolops init --yes')
  const equipment = normalizeEquipment(rawEquipment)
  if (!equipment.slots[slotKey]) throw new Error(`未知槽位：${slotKey}`)
  normalizeEquipment(equipment)
  setSlotTools(equipment.slots[slotKey], [])
  equipment.slots[slotKey].health = 'empty'
  writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
  const registry = upgradeRegistry(profile, readJson(cwdPath('.ai-toolops', 'tool-registry.json')) || defaultToolRegistry(profile))
  refreshDerived(profile, equipment, registry)
  console.log(`已卸下槽位：${slotKey}`)
}


function toggle(slotKey, value) {
  if (!slotKey || !['on', 'off', 'true', 'false', '1', '0'].includes(String(value))) {
    throw new Error('用法：ai-toolops toggle <slot> on|off')
  }
  const rawEquipment = readJson(cwdPath('.ai-toolops', 'equipment.json'))
  if (!rawEquipment) throw new Error('未初始化，请先运行 ai-toolops init --yes')
  const equipment = normalizeEquipment(rawEquipment)
  if (!equipment.slots[slotKey]) throw new Error(`未知槽位：${slotKey}`)
  const enabled = ['on', 'true', '1'].includes(String(value))
  equipment.slots[slotKey].enabled = enabled
  equipment.slots[slotKey].updatedAt = timestamp()
  writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
  const registry = upgradeRegistry(profile, readJson(cwdPath('.ai-toolops', 'tool-registry.json')) || defaultToolRegistry(profile))
  refreshDerived(profile, equipment, registry)
  console.log(`${enabled ? '已启用' : '已禁用'}：${slotKey}`)
}

function reorderTools(slotKey, tools) {
  if (!slotKey || !tools?.length) throw new Error('用法：ai-toolops reorder-tools <slot> <tool...>')
  const rawEquipment = readJson(cwdPath('.ai-toolops', 'equipment.json'))
  if (!rawEquipment) throw new Error('未初始化，请先运行 ai-toolops init --yes')
  const equipment = normalizeEquipment(rawEquipment)
  if (!equipment.slots[slotKey]) throw new Error(`未知槽位：${slotKey}`)
  const existing = getSlotTools(equipment.slots[slotKey])
  const unknown = tools.filter((tool) => !existing.includes(tool))
  if (unknown.length) throw new Error(`槽位 ${slotKey} 不包含这些工具：${unknown.join(', ')}`)
  reorderSlotTools(equipment.slots[slotKey], tools)
  writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
  const registry = upgradeRegistry(profile, readJson(cwdPath('.ai-toolops', 'tool-registry.json')) || defaultToolRegistry(profile))
  refreshDerived(profile, equipment, registry)
  console.log(`已排序：${slotKey} -> ${getSlotTools(equipment.slots[slotKey]).join(' > ')}`)
}


function createSlot(slotKey, flags) {
  if (!slotKey) throw new Error('用法：ai-toolops create-slot <slot> --label 名称 [--default-tool 工具] [--slot-type 类型] [--workflow-stage 阶段]')
  if (!/^[a-z][a-z0-9_\-]*$/.test(slotKey)) throw new Error('slot 只能使用小写字母、数字、下划线或中划线，并以字母开头')
  const rawEquipment = readJson(cwdPath('.ai-toolops', 'equipment.json'))
  const rawCapabilities = readJson(cwdPath('.ai-toolops', 'capabilities.json'))
  if (!rawEquipment || !rawCapabilities) throw new Error('未初始化，请先运行 ai-toolops init --yes')
  const equipment = normalizeEquipment(rawEquipment)
  equipment.slots ||= {}
  rawCapabilities.capabilities ||= {}
  if (equipment.slots[slotKey]) throw new Error(`槽位已存在：${slotKey}`)
  const label = flags.get('label') || slotKey
  const defaultTool = flags.get('default-tool') || ''
  const fallback = String(flags.get('fallback') || '').split(',').map((item) => item.trim()).filter(Boolean)
  const loadLevel = flags.get('load-level') || 'L1'
  const autoLoad = flags.get('auto-load') || 'on_demand'
  const slotType = flags.get('slot-type') || 'exclusive_priority'
  if (!SLOT_TYPES.has(slotType)) throw new Error(`未知槽位类型：${slotType}。可选：${Array.from(SLOT_TYPES).join(', ')}`)
  const requestedStage = flags.get('workflow-stage')
  if (requestedStage && !WORKFLOW_STAGE_KEYS.has(requestedStage)) throw new Error(`非法 workflow stage：${requestedStage}。允许值：${Array.from(WORKFLOW_STAGE_KEYS).join(', ')}`)
  const workflowStage = normalizeWorkflowStage(requestedStage, slotKey)
  const relationGroup = flags.get('relation-group') || ''
  const category = flags.get('category') || (slotType === 'project_context' ? 'project_builtin' : slotType === 'internal_adapter' ? 'agent_adapter' : 'external_tool')
  equipment.slots[slotKey] = {
    label,
    tools: [],
    active: null,
    fallback,
    loadLevel,
    autoLoad,
    enabled: true,
    health: 'empty',
    recommendedTool: defaultTool,
    slotType,
    workflowStage,
    relationGroup,
    category,
    updatedAt: timestamp()
  }
  rawCapabilities.capabilities[slotKey] = {
    label,
    contract: ['由用户新增，需在后续版本补充能力契约。'],
    slotType,
    workflowStage,
    relationGroup,
    category,
    loadLevel,
    defaultTool,
    fallback
  }
  equipment.updatedAt = timestamp()
  rawCapabilities.updatedAt = timestamp()
  writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
  writeJson(cwdPath('.ai-toolops', 'capabilities.json'), rawCapabilities)
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
  const registry = upgradeRegistry(profile, readJson(cwdPath('.ai-toolops', 'tool-registry.json')) || defaultToolRegistry(profile))
  refreshDerived(profile, equipment, registry)
  console.log(`已创建槽位：${slotKey}（${label}），类型：${slotType}，流程阶段：${workflowStageLabel(workflowStage)}，默认工具：${defaultTool || '无'}。`)
}

function registerTool(slotKey, toolName, flags) {
  if (!slotKey || !toolName) throw new Error('用法：ai-toolops register-tool <slot> <tool> [--label 名称]')
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
  const equipment = normalizeEquipment(readJson(cwdPath('.ai-toolops', 'equipment.json')))
  const registry = upgradeRegistry(profile, readJson(cwdPath('.ai-toolops', 'tool-registry.json')))
  if (!equipment || !registry) throw new Error('未初始化，请先运行 ai-toolops init --yes')
  if (!equipment.slots[slotKey]) throw new Error(`未知槽位：${slotKey}`)
  registry.tools ||= {}
  const slot = equipment.slots[slotKey]
  registry.tools[toolName] = {
    ...(registry.tools[toolName] || {}),
    label: flags.get('label') || registry.tools[toolName]?.label || toolName,
    status: flags.get('status') || registry.tools[toolName]?.status || 'user-installed',
    type: flags.get('type') || registry.tools[toolName]?.type || slot.category || 'external_tool',
    capabilities: Array.from(new Set([...(registry.tools[toolName]?.capabilities || []), slotKey])),
    installScope: flags.get('install-scope') || registry.tools[toolName]?.installScope || 'local-or-agent-env',
    localFirst: true,
    cloudUpload: false,
    autoUpdate: false,
    autoBackgroundScan: false,
    installHint: flags.get('install-hint') || registry.tools[toolName]?.installHint || '请按官方方式完成安装后再接入 AI ToolOps。',
    uninstall: registry.tools[toolName]?.uninstall || '从对应本地环境或 Agent 配置中移除，并运行 ai-toolops unequip 清空槽位。'
  }
  registry.updatedAt = timestamp()
  writeJson(cwdPath('.ai-toolops', 'tool-registry.json'), registry)
  writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
  refreshDerived(profile, equipment, registry)
  console.log(`已注册工具：${toolName} -> ${slotKey}`)
}


function generateAgentRules(flags = new Map()) {
  const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
  const equipment = normalizeEquipment(readJson(cwdPath('.ai-toolops', 'equipment.json')) || buildEquipment(profile))
  const registry = upgradeRegistry(profile, readJson(cwdPath('.ai-toolops', 'tool-registry.json')) || defaultToolRegistry(profile))
  if (!readJson(cwdPath('.ai-toolops', 'equipment.json'))) throw new Error('未初始化，请先运行 ai-toolops init --yes')
  const adapters = normalizeAdapters(readJson(cwdPath('.ai-toolops', 'adapters.json')) || defaultAdapters())
  writeJson(cwdPath('.ai-toolops', 'equipment.json'), equipment)
  writeJson(cwdPath('.ai-toolops', 'tool-registry.json'), registry)
  writeJson(cwdPath('.ai-toolops', 'adapters.json'), adapters)
  const report = refreshDerived(profile, equipment, registry, adapters, { agent: flags.get('agent') || 'all' })
  if (flags.get('apply') === true || flags.get('apply') === 'true') {
    syncAgentsMarkdown()
  }
  console.log(JSON.stringify({
    ok: true,
    project: profile.name,
    generated: [
      '.ai-toolops/effective-policy.md',
      '.ai-toolops/generated/AGENTS.toolops.md',
      '.ai-toolops/generated/CODEX.toolops.md',
      '.ai-toolops/generated/CLAUDE.toolops.md',
      '.ai-toolops/generated/ROO.toolops.md',
      '.ai-toolops/generated/rules/index.md',
      '.ai-toolops/generated/rules/project-retrieval.md',
      '.ai-toolops/generated/rules/feedback.md',
      '.ai-toolops/adapters.json',
      '.ai-toolops/adapters/index.md'
    ],
    targetAgent: flags.get('agent') || 'all',
    syncedAgentsMd: Boolean(flags.get('apply') === true || flags.get('apply') === 'true'),
    warnings: report.summary?.warnings || 0,
    errors: report.summary?.errors || 0
  }, null, 2))
}


function adaptersCommand(action = 'list', adapterId = '') {
  const configPath = cwdPath('.ai-toolops', 'adapters.json')
  let config = normalizeAdapters(readJson(configPath) || defaultAdapters())
  if (action === 'list' || !action) {
    writeJson(configPath, config)
    console.log(JSON.stringify({
      ok: true,
      adapters: Object.values(config.adapters || {}).map((adapter) => ({
        id: adapter.id,
        label: adapter.label,
        enabled: adapter.enabled !== false,
        tool: adapter.tool,
        generatedFile: adapter.generatedFile,
        entryFiles: adapter.entryFiles,
        managedBlock: adapter.managedBlock
      }))
    }, null, 2))
    return
  }
  if (!adapterId) throw new Error('用法：ai-toolops adapters list|enable|disable <adapter>')
  if (action === 'enable' || action === 'disable') {
    config = setAdapterEnabled(config, adapterId, action === 'enable')
    writeJson(configPath, config)
    const profile = readJson(cwdPath('.ai-toolops', 'project.profile.json')) || scanProject()
    const equipment = normalizeEquipment(readJson(cwdPath('.ai-toolops', 'equipment.json')) || buildEquipment(profile))
    const registry = upgradeRegistry(profile, readJson(cwdPath('.ai-toolops', 'tool-registry.json')) || defaultToolRegistry(profile))
    refreshDerived(profile, equipment, registry, config, { agent: 'all' })
    console.log(`${action === 'enable' ? '已启用' : '已禁用'}适配器：${adapterId}`)
    return
  }
  throw new Error('用法：ai-toolops adapters list|enable|disable <adapter>')
}

function syncAgentsMarkdown() {
  const file = cwdPath('AGENTS.md')
  const start = '<!-- AI ToolOps:begin -->'
  const end = '<!-- AI ToolOps:end -->'
  const block = `${start}\n${renderAgentRulesInclude().trim()}\n${end}`
  const current = readText(file, '')
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`)
  const next = pattern.test(current)
    ? current.replace(pattern, block)
    : `${current.trim() ? `${current.trim()}\n\n` : ''}${block}\n`
  writeText(file, next.endsWith('\n') ? next : `${next}\n`)
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pluginCommand(action = 'scan', args = [], flags = new Map()) {
  if (action === 'scan' || !action) {
    const tools = scanToolPlugins()
    const skills = scanSkillPlugins()
    const registry = scanAndWriteRegistry()
    console.log(JSON.stringify({
      ok: true,
      tools: Object.keys(tools).length,
      skills: Object.keys(skills).length,
      toolNames: Object.keys(tools),
      skillNames: Object.keys(skills)
    }, null, 2))
    return
  }
  if (action === 'list') {
    const registry = readPluginRegistry()
    console.log(JSON.stringify({
      ok: true,
      tools: registry.tools || {},
      skills: registry.skills || {}
    }, null, 2))
    return
  }
  throw new Error('用法：ai-toolops plugin scan|list')
}

function skillCommand(action = 'list', skillName = '', flags = new Map()) {
  const registry = readPluginRegistry()
  const skills = registry.skills || {}

  if (action === 'list' || !action) {
    console.log(JSON.stringify({
      ok: true,
      skills: Object.entries(skills).map(([name, skill]) => ({
        name,
        label: skill.label || name,
        description: skill.description || '',
        enabled: skill.enabled !== false,
        workflowStage: skill.workflowStage || '',
        requiredTools: skill.requiredTools || []
      }))
    }, null, 2))
    return
  }

  if (!skillName) throw new Error('用法：ai-toolops skill list|enable|disable <name>')

  if (action === 'enable') {
    // 当前 skills 从 plugin-registry 读取，修改后写回（后续可持久化到 equipment.json）
    console.log(JSON.stringify({ ok: true, action: 'enable', skill: skillName, note: 'Skill 启用在当前版本中为可读状态，持久化将在后续迭代实现。' }))
    return
  }

  if (action === 'disable') {
    console.log(JSON.stringify({ ok: true, action: 'disable', skill: skillName, note: 'Skill 关闭在后续迭代实现。' }))
    return
  }

  throw new Error('用法：ai-toolops skill list|enable|disable <name>')
}

