import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { atomicWrite } from './config.js'
import { ensureWindowsLayout, windowsPaths } from './windows-store.js'

const activeLocks = new Set()

export function createActionPlan(input) {
  return {
    schemaVersion: 1,
    id: input.id || crypto.randomUUID(),
    action: input.action,
    providerId: input.providerId,
    tool: input.tool,
    changes: input.changes || [],
    permissions: {
      network: Boolean(input.permissions?.network),
      processes: input.permissions?.processes || [],
      writePaths: input.permissions?.writePaths || []
    },
    rollbackSupported: input.rollbackSupported !== false,
    details: input.details || {}
  }
}

export async function executeTransaction(plan, executor, options = {}) {
  if (options.dryRun) return { dryRun: true, plan }
  if (!options.confirmed) throw new Error('变更操作需要确认；交互确认或使用 --yes，预览使用 --dry-run')
  const paths = ensureWindowsLayout(options.machine || {})
  const release = acquireLock(paths.root, options.lockTimeoutMs)
  const receipt = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    planId: plan.id,
    action: plan.action,
    providerId: plan.providerId,
    tool: plan.tool,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    steps: [],
    rollback: null,
    error: null
  }
  const receiptFile = path.join(paths.receipts, `${receipt.id}.json`)
  writeReceipt(receiptFile, receipt)
  const context = {
    receipt,
    receiptFile,
    step(name, data = {}) {
      receipt.steps.push({ name, at: new Date().toISOString(), ...data })
      writeReceipt(receiptFile, receipt)
    }
  }
  try {
    const result = await executor(context)
    receipt.status = result?.deferredCompletion ? 'scheduled' : 'succeeded'
    receipt.finishedAt = result?.deferredCompletion ? null : new Date().toISOString()
    receipt.result = sanitizeReceiptData(result)
    writeReceipt(receiptFile, receipt)
    return { plan, receipt, receiptFile, result }
  } catch (error) {
    receipt.status = 'failed'
    receipt.error = { message: error.message, code: error.code || null }
    if (typeof options.rollback === 'function') {
      try {
        const rollback = await options.rollback(context, error)
        receipt.rollback = { status: 'succeeded', result: sanitizeReceiptData(rollback) }
        receipt.status = 'rolled_back'
      } catch (rollbackError) {
        receipt.rollback = { status: 'failed', error: rollbackError.message }
      }
    }
    receipt.finishedAt = new Date().toISOString()
    writeReceipt(receiptFile, receipt)
    error.receiptFile = receiptFile
    throw error
  } finally {
    release()
  }
}

export function readReceipts(options = {}) {
  const paths = windowsPaths(options.machine || options)
  if (!fs.existsSync(paths.receipts)) return []
  return fs.readdirSync(paths.receipts)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .reverse()
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(paths.receipts, file), 'utf8'))
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function acquireLock(root, lockTimeoutMs = 15 * 60 * 1000) {
  fs.mkdirSync(root, { recursive: true })
  const lockFile = path.join(root, '.lock')
  try {
    if (activeLocks.has(lockFile)) throw new Error(`当前进程已有 AI ToolOps 事务正在运行：${lockFile}`)
    const handle = fs.openSync(lockFile, 'wx')
    fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }))
    fs.closeSync(handle)
    activeLocks.add(lockFile)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    let stale = false
    try {
      const stat = fs.statSync(lockFile)
      stale = Date.now() - stat.mtimeMs > lockTimeoutMs
      const owner = JSON.parse(fs.readFileSync(lockFile, 'utf8'))
      if (owner.pid === process.pid) stale = true
    } catch {
      stale = true
    }
    if (!stale) throw new Error(`另一个 AI ToolOps 事务正在运行：${lockFile}`)
    fs.rmSync(lockFile, { force: true })
    return acquireLock(root, lockTimeoutMs)
  }
  return () => {
    try {
      fs.unlinkSync(lockFile)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    activeLocks.delete(lockFile)
    if (fs.existsSync(lockFile)) throw new Error(`事务锁释放失败：${lockFile}`)
  }
}

function writeReceipt(file, receipt) {
  atomicWrite(file, `${JSON.stringify(receipt, null, 2)}\n`)
}

function sanitizeReceiptData(value) {
  if (!value || typeof value !== 'object') return value ?? null
  const clone = structuredClone(value)
  removeSecrets(clone)
  return clone
}

function removeSecrets(value) {
  if (!value || typeof value !== 'object') return
  for (const key of Object.keys(value)) {
    if (/secret|credential|token|password/i.test(key)) {
      value[key] = '[redacted]'
      continue
    }
    removeSecrets(value[key])
  }
}
