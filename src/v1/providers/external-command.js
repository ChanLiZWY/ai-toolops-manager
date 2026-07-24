import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createActionPlan } from '../transaction.js'

export const externalCommandProvider = {
  metadata() {
    return { id: 'external-command', label: 'External command', executable: true, managed: false }
  },
  detect(options = {}) {
    const executable = options.path ? path.resolve(options.path) : null
    return { found: Boolean(executable && fs.existsSync(executable)), executable }
  },
  healthCheck(entry) {
    if (!entry?.invocation?.command || !fs.existsSync(entry.invocation.command)) return { healthy: false, message: '外部工具路径不存在' }
    const result = spawnSync(entry.invocation.command, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10000 })
    return { healthy: result.status === 0, message: result.status === 0 ? firstLine(result.stdout) : firstLine(result.stderr) || '版本检查失败' }
  },
  plan(action, options = {}) {
    if (action !== 'register' && action !== 'uninstall') throw new Error('external-command 只支持 register/uninstall')
    const executable = options.path ? path.resolve(options.path) : null
    if (action === 'register' && (!executable || !path.isAbsolute(executable))) throw new Error('外部工具必须提供绝对路径')
    return createActionPlan({
      action,
      providerId: 'external-command',
      tool: options.tool,
      changes: action === 'register'
        ? [{ scope: 'machine', operation: 'register', target: executable }]
        : [{ scope: 'machine', operation: 'unregister', target: options.tool }],
      permissions: { writePaths: [options.inventoryFile].filter(Boolean) },
      details: { executable }
    })
  },
  async apply(plan) {
    if (plan.action === 'uninstall') return { removeInventory: true }
    const executable = plan.details.executable
    if (!fs.existsSync(executable)) throw new Error(`外部工具不存在：${executable}`)
    return {
      entry: {
        providerId: 'external-command',
        source: 'external',
        version: 'external',
        invocation: { kind: 'cli', command: executable },
        health: 'healthy',
        installedAt: new Date().toISOString()
      }
    }
  },
  async rollback() {
    return { changed: false }
  }
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/).find(Boolean) || ''
}
