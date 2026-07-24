import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

export const PROJECT_SCHEMA_VERSION = 1

export function projectPaths(projectRoot = process.cwd()) {
  const root = path.resolve(projectRoot)
  const configRoot = path.join(root, '.ai-toolops')
  return {
    projectRoot: root,
    configRoot,
    policy: path.join(configRoot, 'policy.yaml'),
    lock: path.join(configRoot, 'toolops.lock.json')
  }
}

export function defaultPolicy() {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    capabilities: {
      exact_search: { required: true, providers: ['rg'] },
      semantic_search: { required: false, providers: ['semble'] },
      code_graph: { required: false, providers: ['codebase-memory-mcp'] },
      human_confirmation: { required: false, providers: ['askhuman'] }
    },
    safety: {
      install: 'confirm',
      update: 'confirm',
      uninstall: 'confirm',
      agentBinding: 'confirm'
    }
  }
}

export function defaultLock() {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    generatedBy: 'ai-toolops',
    tools: {}
  }
}

export function readProjectConfig(projectRoot = process.cwd(), options = {}) {
  const paths = projectPaths(projectRoot)
  const policy = readYaml(paths.policy)
  const lock = readJson(paths.lock)
  if (!policy && !lock && options.allowMissing !== false) {
    return { ...paths, initialized: false, policy: null, lock: null, errors: [] }
  }
  const errors = [
    ...validatePolicy(policy),
    ...validateLock(lock)
  ]
  return { ...paths, initialized: Boolean(policy && lock), policy, lock, errors }
}

export function validatePolicy(policy) {
  const errors = []
  if (!policy || typeof policy !== 'object') return ['policy.yaml 缺失或无法解析']
  if (policy.schemaVersion !== PROJECT_SCHEMA_VERSION) errors.push(`policy.yaml schemaVersion 必须为 ${PROJECT_SCHEMA_VERSION}`)
  if (!policy.capabilities || typeof policy.capabilities !== 'object' || Array.isArray(policy.capabilities)) {
    errors.push('policy.yaml capabilities 必须是对象')
  } else {
    for (const [id, capability] of Object.entries(policy.capabilities)) {
      if (!/^[a-z][a-z0-9_-]*$/.test(id)) errors.push(`能力 ID 非法：${id}`)
      if (!capability || typeof capability !== 'object') {
        errors.push(`能力 ${id} 配置必须是对象`)
        continue
      }
      if (typeof capability.required !== 'boolean') errors.push(`能力 ${id}.required 必须是布尔值`)
      if (!Array.isArray(capability.providers) || capability.providers.some((item) => typeof item !== 'string' || !item.trim())) {
        errors.push(`能力 ${id}.providers 必须是非空字符串数组`)
      }
    }
  }
  errors.push(...findForbiddenProjectState(policy, 'policy'))
  return errors
}

export function validateLock(lock) {
  const errors = []
  if (!lock || typeof lock !== 'object') return ['toolops.lock.json 缺失或无法解析']
  if (lock.schemaVersion !== PROJECT_SCHEMA_VERSION) errors.push(`toolops.lock.json schemaVersion 必须为 ${PROJECT_SCHEMA_VERSION}`)
  if (!lock.tools || typeof lock.tools !== 'object' || Array.isArray(lock.tools)) errors.push('toolops.lock.json tools 必须是对象')
  errors.push(...findForbiddenProjectState(lock, 'lock'))
  return errors
}

export function serializePolicy(policy) {
  return YAML.stringify(policy, { indent: 2, lineWidth: 0 })
}

export function writeProjectConfig(projectRoot, policy, lock) {
  const paths = projectPaths(projectRoot)
  const errors = [...validatePolicy(policy), ...validateLock(lock)]
  if (errors.length) throw new Error(`项目配置无效：${errors.join('；')}`)
  fs.mkdirSync(paths.configRoot, { recursive: true })
  atomicWrite(paths.policy, serializePolicy(policy))
  atomicWrite(paths.lock, `${JSON.stringify(lock, null, 2)}\n`)
  return paths
}

export function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, content, 'utf8')
  fs.renameSync(temp, file)
}

function findForbiddenProjectState(value, location) {
  const errors = []
  const forbiddenKeys = /^(path|paths|installPath|managedRoot|health|healthy|credential|credentials|receipt|receipts|agentConfigPath)$/i
  function visit(node, at) {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${at}[${index}]`))
      return
    }
    if (!node || typeof node !== 'object') {
      if (typeof node === 'string' && isWindowsAbsolutePath(node)) errors.push(`${at} 不能包含 Windows 绝对路径`)
      return
    }
    for (const [key, child] of Object.entries(node)) {
      const next = `${at}.${key}`
      if (forbiddenKeys.test(key)) errors.push(`${next} 属于机器或运行时状态，不能写入项目配置`)
      visit(child, next)
    }
  }
  visit(value, location)
  return errors
}

function isWindowsAbsolutePath(value) {
  return /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value)
}

function readYaml(file) {
  if (!fs.existsSync(file)) return null
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function readJson(file) {
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}
