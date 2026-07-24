import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createActionPlan } from '../transaction.js'
import { windowsPaths } from '../windows-store.js'

const DEFAULT_VERSION = '15.1.0'

export const rgProvider = {
  metadata() {
    return {
      id: 'rg',
      label: 'ripgrep',
      managed: true,
      supported: ['win32-x64'],
      defaultVersion: DEFAULT_VERSION
    }
  },
  detect(options = {}) {
    const entry = options.inventory?.tools?.rg
    if (entry?.invocation?.command && fs.existsSync(entry.invocation.command)) return { found: true, source: entry.source, entry }
    const result = spawnSync('where.exe', ['rg.exe'], { encoding: 'utf8', windowsHide: true })
    const executable = result.status === 0 ? firstLine(result.stdout) : null
    return { found: Boolean(executable), source: executable ? 'system' : null, executable }
  },
  healthCheck(entry) {
    const executable = entry?.invocation?.command
    if (!executable || !fs.existsSync(executable)) return { healthy: false, message: 'rg.exe 不存在' }
    const result = spawnSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10000 })
    return { healthy: result.status === 0, message: result.status === 0 ? firstLine(result.stdout) : firstLine(result.stderr) || 'rg --version 失败' }
  },
  plan(action, options = {}) {
    if (!['install', 'update', 'repair', 'uninstall'].includes(action)) throw new Error(`rg Provider 不支持 ${action}`)
    const version = String(options.version || DEFAULT_VERSION)
    const paths = windowsPaths(options.machine || {})
    const targetDir = path.join(paths.tools, 'rg', version, 'win32-x64')
    const source = options.source || `https://github.com/BurntSushi/ripgrep/releases/download/${version}/ripgrep-${version}-x86_64-pc-windows-msvc.zip`
    const network = /^https?:\/\//i.test(source)
    return createActionPlan({
      action,
      providerId: 'rg',
      tool: 'rg',
      changes: [{
        scope: 'machine',
        operation: action,
        target: targetDir,
        version
      }],
      permissions: {
        network: action !== 'uninstall' && network,
        processes: action === 'uninstall' ? [] : ['powershell.exe', 'rg.exe'],
        writePaths: [targetDir, paths.inventory, paths.receipts, paths.cache]
      },
      details: {
        version,
        source,
        checksum: options.checksum || null,
        checksumSource: options.checksumSource || (network ? `${source}.sha256` : null),
        targetDir,
        executable: path.join(targetDir, 'rg.exe')
      }
    })
  },
  async apply(plan, context = {}) {
    if (plan.action === 'uninstall') {
      const targetDir = safeManagedTarget(plan.details.targetDir, context.machine)
      const pendingRemove = `${targetDir}.removing-${plan.id}`
      if (fs.existsSync(pendingRemove)) fs.rmSync(pendingRemove, { recursive: true, force: true })
      if (fs.existsSync(targetDir)) fs.renameSync(targetDir, pendingRemove)
      return { removeInventory: true, removed: targetDir, pendingRemove }
    }
    const paths = windowsPaths(context.machine || {})
    const targetDir = safeManagedTarget(plan.details.targetDir, context.machine)
    if (fs.existsSync(plan.details.executable)) {
      const existing = this.healthCheck({ invocation: { command: plan.details.executable } })
      if (existing.healthy && plan.action !== 'repair') return { entry: inventoryEntry(plan), changed: false }
    }
    fs.mkdirSync(paths.cache, { recursive: true })
    const staging = path.join(paths.cache, `rg-${plan.id}`)
    const archive = `${staging}.zip`
    fs.rmSync(staging, { recursive: true, force: true })
    fs.rmSync(archive, { force: true })
    try {
      await materialize(plan.details.source, archive)
      const checksum = plan.details.checksum || await loadChecksum(plan.details.checksumSource)
      if (!checksum) throw new Error('缺少可信 SHA-256，拒绝安装')
      const actual = sha256(archive)
      if (actual.toLowerCase() !== checksum.toLowerCase()) throw new Error(`SHA-256 不匹配：expected=${checksum} actual=${actual}`)
      expandArchive(archive, staging)
      const executable = findFile(staging, 'rg.exe')
      if (!executable) throw new Error('压缩包中没有 rg.exe')
      const stagedHealth = this.healthCheck({ invocation: { command: executable } })
      if (!stagedHealth.healthy) throw new Error(`rg 健康检查失败：${stagedHealth.message}`)
      const backup = `${targetDir}.backup-${plan.id}`
      if (fs.existsSync(targetDir)) fs.renameSync(targetDir, backup)
      fs.mkdirSync(path.dirname(targetDir), { recursive: true })
      fs.renameSync(path.dirname(executable), targetDir)
      if (!fs.existsSync(path.join(targetDir, 'rg.exe'))) {
        fs.copyFileSync(executable, path.join(targetDir, 'rg.exe'))
      }
      fs.rmSync(backup, { recursive: true, force: true })
      return { entry: inventoryEntry({ ...plan, details: { ...plan.details, checksum: actual } }), changed: true, checksum: actual }
    } finally {
      fs.rmSync(staging, { recursive: true, force: true })
      fs.rmSync(archive, { force: true })
    }
  },
  async rollback(plan, result, context = {}) {
    if (result?.pendingRemove && fs.existsSync(result.pendingRemove)) {
      fs.renameSync(result.pendingRemove, plan.details.targetDir)
      return { restored: plan.details.targetDir }
    }
    if (result?.changed && plan.action === 'install') {
      const targetDir = safeManagedTarget(plan.details.targetDir, context.machine)
      fs.rmSync(targetDir, { recursive: true, force: true })
      return { removed: targetDir }
    }
    return { changed: false }
  },
  async finalize(plan, result) {
    if (result?.pendingRemove) fs.rmSync(result.pendingRemove, { recursive: true, force: true })
  }
}

function inventoryEntry(plan) {
  return {
    providerId: 'rg',
    source: 'managed',
    version: plan.details.version,
    artifact: {
      url: /^https?:\/\//i.test(plan.details.source) ? plan.details.source : null,
      sha256: plan.details.checksum
    },
    invocation: { kind: 'cli', command: plan.details.executable },
    health: 'healthy',
    installedAt: new Date().toISOString()
  }
}

async function materialize(source, destination) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { redirect: 'follow' })
    if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`)
    fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()))
    return
  }
  const local = path.resolve(source)
  if (!fs.existsSync(local)) throw new Error(`artifact 不存在：${local}`)
  fs.copyFileSync(local, destination)
}

async function loadChecksum(source) {
  if (!source) return null
  let content
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { redirect: 'follow' })
    if (!response.ok) throw new Error(`校验文件下载失败：HTTP ${response.status}`)
    content = await response.text()
  } else {
    content = fs.readFileSync(path.resolve(source), 'utf8')
  }
  const match = content.match(/\b[a-fA-F0-9]{64}\b/)
  return match?.[0] || null
}

function expandArchive(archive, destination) {
  fs.mkdirSync(destination, { recursive: true })
  const script = `Expand-Archive -LiteralPath '${escapePowerShell(archive)}' -DestinationPath '${escapePowerShell(destination)}' -Force`
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000
  })
  if (result.status !== 0) throw new Error(`Expand-Archive 失败：${firstLine(result.stderr)}`)
}

function safeManagedTarget(target, machine) {
  const toolsRoot = path.resolve(windowsPaths(machine || {}).tools)
  const resolved = path.resolve(target)
  const relative = path.relative(toolsRoot, resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`拒绝操作托管目录之外的路径：${resolved}`)
  return resolved
}

function findFile(root, name) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      const found = findFile(full, name)
      if (found) return found
    } else if (entry.name.toLowerCase() === name.toLowerCase()) return full
  }
  return null
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function escapePowerShell(value) {
  return String(value).replaceAll("'", "''")
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/).find(Boolean) || ''
}
