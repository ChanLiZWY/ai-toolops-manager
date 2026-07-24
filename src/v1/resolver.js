import { spawnSync } from 'node:child_process'
import { readProjectConfig } from './config.js'
import { discoverAgentBindings, normalizeName, resolveAgent } from './agents.js'
import { readInventory } from './windows-store.js'
import { getProvider } from './providers/registry.js'

const BUILTIN_PROVIDERS = {
  rg: { kind: 'cli', commands: ['rg.exe', 'rg'], label: 'ripgrep' },
  semble: { kind: 'cli', commands: ['semble.exe', 'semble.cmd', 'semble'], label: 'Semble' },
  askhuman: { kind: 'cli', commands: ['AskHuman.cmd', 'AskHuman.exe'], label: 'AskHuman' },
  'codebase-memory-mcp': {
    kind: 'mcp',
    aliases: ['codebase-memory-mcp', 'codebase_memory_mcp', 'codebase-memory', 'codebase_memory'],
    label: 'Codebase Memory MCP'
  }
}

export function resolveContext(options = {}) {
  const project = readProjectConfig(options.projectRoot, { allowMissing: true })
  const machine = readInventory(options.machine || {})
  const agent = resolveAgent(options.agent || 'auto', options.env || process.env)
  const bindings = discoverAgentBindings(agent.resolved, {
    projectRoot: project.projectRoot,
    ...(options.agentOptions || {})
  })
  const capabilities = []
  for (const [id, capability] of Object.entries(project.policy?.capabilities || {})) {
    capabilities.push(resolveCapability(id, capability, machine.inventory, bindings))
  }
  const warnings = []
  if (!project.initialized) warnings.push('项目尚未初始化，请运行 ai-toolops init')
  warnings.push(...project.errors)
  warnings.push(...machine.errors)
  if (agent.requested === 'auto' && agent.resolved === 'generic') warnings.push('无法可靠识别当前 Agent，已安全回退 generic；宿主专属工具不会被标记为可用')
  const nextActions = capabilities
    .filter((item) => item.required && item.status.resolution !== 'ready')
    .map((item) => `安装或修复能力 ${item.id}：ai-toolops install ${item.providerId || item.id}`)
  return {
    schemaVersion: 1,
    project: {
      root: project.projectRoot,
      initialized: project.initialized,
      policyVersion: project.policy?.schemaVersion || null,
      lockStatus: project.lock ? (project.errors.length ? 'invalid' : 'current') : 'missing'
    },
    agent,
    capabilities,
    warnings,
    nextActions,
    meta: {
      machineRoot: machine.paths.root,
      bindingSources: bindings.sources
    }
  }
}

export function renderContext(context) {
  const lines = [
    '# AI ToolOps Context',
    '',
    `项目：${context.project.root}`,
    `Agent：${context.agent.resolved}（${context.agent.confidence}）`,
    `项目状态：${context.project.initialized ? context.project.lockStatus : 'not-initialized'}`,
    '',
    '## 能力'
  ]
  if (!context.capabilities.length) lines.push('- 当前没有已配置能力。')
  for (const capability of context.capabilities) {
    const status = capability.status
    lines.push(`- ${capability.id}：${status.resolution}；Provider=${capability.providerId || 'none'}；安装=${status.installation}；绑定=${status.binding}；健康=${status.health}`)
    if (capability.invocation) lines.push(`  调用：${capability.invocation.command || capability.invocation.name}`)
  }
  if (context.warnings.length) {
    lines.push('', '## 警告')
    for (const warning of context.warnings) lines.push(`- ${warning}`)
  }
  if (context.nextActions.length) {
    lines.push('', '## 下一步')
    for (const action of context.nextActions) lines.push(`- ${action}`)
  }
  lines.push('', '> Context 是协作式规则和状态说明，不是工具调用 Gateway。')
  return `${lines.join('\n')}\n`
}

function resolveCapability(id, capability, inventory, bindings) {
  const providers = Array.isArray(capability.providers) ? capability.providers : []
  const candidates = providers.map((providerId) => resolveProvider(providerId, inventory, bindings))
  const selected = candidates.find((item) => item.status.resolution === 'ready') || candidates[0] || emptyProvider()
  return {
    id,
    required: capability.required === true,
    providerId: selected.providerId,
    candidates,
    status: selected.status,
    invocation: selected.invocation || null
  }
}

function resolveProvider(providerId, inventory, bindings) {
  const definition = BUILTIN_PROVIDERS[providerId]
  const inventoryEntry = inventory.tools?.[providerId]
  if (inventoryEntry) {
    let healthy = inventoryEntry.health !== 'broken'
    try {
      healthy = getProvider(inventoryEntry.providerId || providerId).healthCheck(inventoryEntry).healthy
    } catch {
      healthy = false
    }
    return {
      providerId,
      status: {
        installation: inventoryEntry.source || 'managed',
        binding: definition?.kind === 'mcp' ? bindingState(definition, bindings) : 'bound',
        health: healthy ? 'healthy' : 'broken',
        resolution: healthy && (definition?.kind !== 'mcp' || bindingState(definition, bindings) === 'bound') ? 'ready' : 'blocked'
      },
      invocation: inventoryEntry.invocation || null
    }
  }
  if (!definition) {
    return { providerId, status: { installation: 'absent', binding: 'unknown', health: 'unverified', resolution: 'missing' }, invocation: null }
  }
  if (definition.kind === 'mcp') {
    const binding = bindingState(definition, bindings)
    return {
      providerId,
      status: {
        installation: binding === 'bound' ? 'host' : 'absent',
        binding,
        health: binding === 'bound' ? 'unverified' : 'unverified',
        resolution: binding === 'bound' ? 'ready' : 'missing'
      },
      invocation: binding === 'bound' ? { kind: 'mcp', name: definition.aliases[0] } : null
    }
  }
  const command = findCommand(definition.commands)
  return {
    providerId,
    status: {
      installation: command ? 'system' : 'absent',
      binding: command ? 'bound' : 'unbound',
      health: command ? 'healthy' : 'unverified',
      resolution: command ? 'ready' : 'missing'
    },
    invocation: command ? { kind: 'cli', command } : null
  }
}

function bindingState(definition, bindings) {
  const found = definition.aliases.some((alias) => bindings.servers[normalizeName(alias)])
  return found ? 'bound' : (bindings.agentId === 'generic' ? 'unsupported' : 'unbound')
}

function findCommand(commands = []) {
  for (const command of commands) {
    const result = spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true })
    if (result.status === 0) return result.stdout.split(/\r?\n/).map((item) => item.trim()).find(Boolean) || command
  }
  return null
}

function emptyProvider() {
  return {
    providerId: null,
    status: { installation: 'absent', binding: 'unknown', health: 'unverified', resolution: 'missing' },
    invocation: null
  }
}
