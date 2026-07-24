import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createActionPlan, executeTransaction } from './transaction.js'
import { windowsPaths } from './windows-store.js'

export function planSelfUpdate(options = {}) {
  if (!options.source) throw new Error('自更新需要 --source <本地文件或 HTTPS URL>')
  const paths = windowsPaths(options.machine || {})
  const installRoot = path.join(process.env.LOCALAPPDATA || path.dirname(paths.root), 'Programs', 'ai-toolops')
  const target = path.resolve(options.target || process.env.AI_TOOLOPS_EXECUTABLE || path.join(installRoot, 'ai-toolops.exe'))
  const source = String(options.source)
  return createActionPlan({
    action: 'self-update',
    providerId: 'core.self-update',
    tool: 'ai-toolops',
    changes: [{ scope: 'machine', operation: 'replace-after-exit', target }],
    permissions: {
      network: /^https:\/\//i.test(source),
      processes: ['powershell.exe', 'ai-toolops.exe'],
      writePaths: [target, paths.cache, paths.receipts]
    },
    details: {
      source,
      checksum: options.checksum || null,
      checksumSource: options.checksumSource || `${source}.sha256`,
      target
    }
  })
}

export function applySelfUpdate(plan, options = {}) {
  const paths = windowsPaths(options.machine || {})
  let staged = null
  let helper = null
  return executeTransaction(plan, async (transaction) => {
    if (!fs.existsSync(plan.details.target)) throw new Error(`安装目标不存在：${plan.details.target}`)
    staged = path.join(paths.cache, `ai-toolops-${plan.id}.exe`)
    helper = path.join(paths.cache, `complete-update-${plan.id}.ps1`)
    await materialize(plan.details.source, staged)
    const expected = plan.details.checksum || await loadChecksum(plan.details.checksumSource)
    if (!expected) throw new Error('缺少 SHA-256，拒绝自更新')
    const actual = sha256(staged)
    if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`SHA-256 不匹配：expected=${expected} actual=${actual}`)
    fs.writeFileSync(helper, updateHelperScript(), 'utf8')
    transaction.step('self-update.staged', { checksum: actual })
    if (options.launchHelper !== false) {
      const child = spawn('powershell.exe', [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', helper,
        '-ParentPid', String(process.pid),
        '-Target', plan.details.target,
        '-Staged', staged
      ], { detached: true, stdio: 'ignore', windowsHide: true })
      child.unref()
      transaction.step('self-update.helper-launched')
    }
    return { status: options.launchHelper === false ? 'staged' : 'scheduled', target: plan.details.target, helper, staged, checksum: actual }
  }, {
    machine: options.machine,
    dryRun: options.dryRun,
    confirmed: options.confirmed,
    rollback: async () => {
      if (staged) fs.rmSync(staged, { force: true })
      if (helper) fs.rmSync(helper, { force: true })
      return { stagedFilesRemoved: true }
    }
  })
}

function updateHelperScript() {
  return `[CmdletBinding()]
param(
  [int]$ParentPid,
  [string]$Target,
  [string]$Staged
)
$ErrorActionPreference = 'Stop'
Wait-Process -Id $ParentPid -ErrorAction SilentlyContinue
$backup = "$Target.backup"
try {
  Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
  Move-Item -LiteralPath $Target -Destination $backup -Force
  Move-Item -LiteralPath $Staged -Destination $Target -Force
  & $Target --version
  if ($LASTEXITCODE -ne 0) { throw 'Updated executable failed version check.' }
  Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
} catch {
  Remove-Item -LiteralPath $Target -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $backup) {
    Move-Item -LiteralPath $backup -Destination $Target -Force
  }
  throw
}
`
}

async function materialize(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  if (/^https:\/\//i.test(source)) {
    const response = await fetch(source, { redirect: 'follow' })
    if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`)
    fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()))
    return
  }
  fs.copyFileSync(path.resolve(source), destination)
}

async function loadChecksum(source) {
  if (/^https:\/\//i.test(source)) {
    const response = await fetch(source, { redirect: 'follow' })
    if (!response.ok) throw new Error(`校验文件下载失败：HTTP ${response.status}`)
    return (await response.text()).match(/\b[a-fA-F0-9]{64}\b/)?.[0] || null
  }
  if (!fs.existsSync(path.resolve(source))) return null
  return fs.readFileSync(path.resolve(source), 'utf8').match(/\b[a-fA-F0-9]{64}\b/)?.[0] || null
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}
