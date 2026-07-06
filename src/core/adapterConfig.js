import { timestamp } from '../utils.js'

const ADAPTER_DEFINITIONS = {
  codex: {
    id: 'codex',
    label: 'Codex',
    enabled: true,
    tool: 'codex-adapter',
    generatedFile: '.ai-toolops/generated/CODEX.toolops.md',
    adapterFile: '.ai-toolops/adapters/codex.toolops.md',
    entryFiles: ['AGENTS.md'],
    managedBlock: true,
    format: 'markdown',
    purpose: '为 Codex / OpenAI Coding Agent 生成项目级工具规则入口。'
  },
  claude: {
    id: 'claude',
    label: 'Claude Code',
    enabled: true,
    tool: 'claude-adapter',
    generatedFile: '.ai-toolops/generated/CLAUDE.toolops.md',
    adapterFile: '.ai-toolops/adapters/claude.toolops.md',
    entryFiles: ['CLAUDE.md'],
    managedBlock: false,
    format: 'markdown',
    purpose: '为 Claude Code 生成可引用的工具规则片段。'
  },
  roo: {
    id: 'roo',
    label: 'Roo Code',
    enabled: true,
    tool: 'roo-adapter',
    generatedFile: '.ai-toolops/generated/ROO.toolops.md',
    adapterFile: '.ai-toolops/adapters/roo.toolops.md',
    entryFiles: ['.roo/rules/toolops.md'],
    managedBlock: false,
    format: 'markdown',
    purpose: '为 Roo Code 生成可映射到模式或规则文件的工具策略。'
  }
}

export function defaultAdapters() {
  return {
    version: 1,
    updatedAt: timestamp(),
    source: 'ai-toolops-manager',
    policy: {
      singleSourceOfTruth: '.ai-toolops/equipment.json',
      generatedRuleIndex: '.ai-toolops/generated/AGENTS.toolops.md',
      effectivePolicy: '.ai-toolops/effective-policy.md',
      noManualJsonEdit: true
    },
    adapters: Object.fromEntries(Object.entries(ADAPTER_DEFINITIONS).map(([id, adapter]) => [id, { ...adapter }]))
  }
}

export function normalizeAdapters(raw) {
  const defaults = defaultAdapters()
  const config = raw && typeof raw === 'object' ? { ...raw } : {}
  config.version = config.version || defaults.version
  config.source = config.source || defaults.source
  config.policy = { ...defaults.policy, ...(config.policy || {}) }
  config.adapters ||= {}
  for (const [id, adapter] of Object.entries(defaults.adapters)) {
    config.adapters[id] = { ...adapter, ...(config.adapters[id] || {}) }
    config.adapters[id].id = id
    config.adapters[id].enabled = config.adapters[id].enabled !== false
  }
  for (const [id, adapter] of Object.entries(config.adapters)) {
    config.adapters[id] = {
      id,
      label: adapter.label || id,
      enabled: adapter.enabled !== false,
      tool: adapter.tool || `${id}-adapter`,
      generatedFile: adapter.generatedFile || `.ai-toolops/generated/${id.toUpperCase()}.toolops.md`,
      adapterFile: adapter.adapterFile || `.ai-toolops/adapters/${id}.toolops.md`,
      entryFiles: Array.isArray(adapter.entryFiles) ? adapter.entryFiles : [],
      managedBlock: Boolean(adapter.managedBlock),
      format: adapter.format || 'markdown',
      purpose: adapter.purpose || 'Agent 规则适配。'
    }
  }
  config.updatedAt = timestamp()
  return config
}

export function adapterList(config, filter = 'all') {
  const normalized = normalizeAdapters(config)
  let adapters = Object.values(normalized.adapters || {})
  if (filter && filter !== 'all') {
    const wanted = new Set(String(filter).split(',').map((item) => item.trim()).filter(Boolean))
    adapters = adapters.filter((adapter) => wanted.has(adapter.id))
  }
  return adapters
}

export function enabledAdapters(config, filter = 'all') {
  return adapterList(config, filter).filter((adapter) => adapter.enabled)
}

export function setAdapterEnabled(config, adapterId, enabled) {
  const normalized = normalizeAdapters(config)
  if (!normalized.adapters[adapterId]) throw new Error(`未知适配器：${adapterId}`)
  normalized.adapters[adapterId].enabled = Boolean(enabled)
  normalized.updatedAt = timestamp()
  return normalized
}
