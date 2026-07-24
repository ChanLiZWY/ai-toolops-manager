import fs from 'node:fs'
import path from 'node:path'
import { defaultLock, defaultPolicy, projectPaths } from './config.js'

const LEGACY_FILES = [
  'project.profile.json',
  'project-dna.json',
  'capabilities.json',
  'equipment.json',
  'tool-registry.json',
  'adapters.json',
  'health-report.json',
  'plugin-registry.json',
  'skills.json',
  'effective-policy.md'
]

const LEGACY_NON_TOOL_CAPABILITIES = new Map([
  ['architecture_context', '项目架构文档由项目自身提供，不属于机器工具库存'],
  ['build_validation', '项目脚本由项目自身提供，不属于机器工具库存'],
  ['agent_compatibility', 'Agent 接入由核心 Agent Adapter 处理，不再作为工具 Provider']
])

export function analyzeMigration(projectRoot = process.cwd()) {
  const paths = projectPaths(projectRoot)
  const found = LEGACY_FILES.filter((file) => fs.existsSync(path.join(paths.configRoot, file)))
  const policy = defaultPolicy()
  const lock = defaultLock()
  const migrated = []
  const dropped = []
  const conflicts = []
  const equipment = readLegacyJson(path.join(paths.configRoot, 'equipment.json'))
  const registry = readLegacyJson(path.join(paths.configRoot, 'tool-registry.json'))
  if (equipment?.slots) {
    policy.capabilities = {}
    for (const [id, slot] of Object.entries(equipment.slots)) {
      if (slot.enabled === false) continue
      if (LEGACY_NON_TOOL_CAPABILITIES.has(id)) {
        dropped.push(`equipment.json slots.${id}：${LEGACY_NON_TOOL_CAPABILITIES.get(id)}`)
        continue
      }
      const providers = unique([...(Array.isArray(slot.tools) ? slot.tools : []), slot.active])
      policy.capabilities[id] = { required: slot.required === true, providers }
      migrated.push(`equipment.json slots.${id} -> policy.yaml capabilities.${id}`)
    }
  }
  for (const [name, tool] of Object.entries(registry?.tools || {})) {
    if (tool.version && tool.version !== 'unknown') {
      lock.tools[name] = { provider: name, version: String(tool.version) }
      migrated.push(`tool-registry.json tools.${name}.version -> toolops.lock.json tools.${name}`)
    }
    if (tool.path || tool.installPath) conflicts.push(`工具 ${name} 的绝对路径只允许迁入电脑库存，正式迁移时需要确认`)
  }
  for (const file of found) {
    if (['project-dna.json', 'health-report.json', 'plugin-registry.json', 'skills.json', 'effective-policy.md'].includes(file)) {
      dropped.push(`${file}：运行时缓存、重复生成物或无可靠消费者`)
    }
  }
  if (!found.length) conflicts.push('没有发现可迁移的旧 .ai-toolops 文件')
  return {
    schemaVersion: 1,
    projectRoot: paths.projectRoot,
    legacyFiles: found,
    targetFiles: ['.ai-toolops/policy.yaml', '.ai-toolops/toolops.lock.json'],
    migrated,
    dropped,
    conflicts,
    preview: { policy, lock },
    writes: []
  }
}

function readLegacyJson(file) {
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function unique(values) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))]
}
