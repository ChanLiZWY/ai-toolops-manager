import fs from 'node:fs'
import { readProjectConfig } from './config.js'
import { resolveContext } from './resolver.js'
import { readInventory } from './windows-store.js'

export function runDoctorV1(options = {}) {
  const project = readProjectConfig(options.projectRoot, { allowMissing: true })
  const machine = readInventory(options.machine || {})
  const context = resolveContext(options)
  const checks = []
  add(checks, process.platform === 'win32', 'platform.windows', `当前平台：${process.platform}`, 'v1 仅支持 Windows 10/11 x64')
  add(checks, process.arch === 'x64', 'platform.arch', `当前架构：${process.arch}`, 'v1 仅支持 x64')
  add(checks, project.initialized, 'project.config', project.initialized ? '项目配置完整' : '项目未初始化', '运行 ai-toolops init')
  add(checks, project.errors.length === 0, 'project.schema', project.errors.length ? project.errors.join('；') : '项目 schema 有效', '修复项目配置或运行迁移预检')
  add(checks, machine.errors.length === 0, 'machine.inventory', machine.errors.length ? machine.errors.join('；') : '电脑库存可读取', '修复 inventory.json 或从回执恢复')
  for (const capability of context.capabilities) {
    const ready = capability.status.resolution === 'ready'
    checks.push({
      id: `capability.${capability.id}`,
      level: ready ? 'ok' : (capability.required ? 'error' : 'warning'),
      message: `${capability.id}: ${capability.status.resolution}`,
      recovery: ready ? null : context.nextActions.find((item) => item.includes(capability.id)) || '检查 Provider 和 Agent 绑定'
    })
  }
  return {
    schemaVersion: 1,
    healthy: checks.every((item) => item.level !== 'error'),
    checks,
    context
  }
}

export function snapshotFiles(files) {
  const result = {}
  for (const file of files) {
    if (!fs.existsSync(file)) {
      result[file] = null
      continue
    }
    const stat = fs.statSync(file)
    result[file] = stat.isFile() ? `${stat.size}:${stat.mtimeMs}` : `dir:${stat.mtimeMs}`
  }
  return result
}

function add(checks, condition, id, message, recovery) {
  checks.push({ id, level: condition ? 'ok' : 'error', message, recovery: condition ? null : recovery })
}
