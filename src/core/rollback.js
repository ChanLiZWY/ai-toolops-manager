import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cwdPath, exists, ensureDir, safeTimestamp, timestamp, writeJson } from '../utils.js'

export function createSnapshot(paths) {
  const toolopsPath = cwdPath('.ai-toolops')
  const toolopsExistedBefore = exists(toolopsPath)
  const dir = cwdPath('.ai-toolops', 'backups', safeTimestamp())
  ensureDir(dir)

  const manifest = {
    createdAt: timestamp(),
    toolopsExistedBefore,
    files: []
  }

  if (toolopsExistedBefore) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-snapshot-'))
    const tempCopy = path.join(temp, '__dot_ai_toolops__')
    fs.cpSync(toolopsPath, tempCopy, {
      recursive: true,
      filter: (source) => {
        const rel = path.relative(toolopsPath, source).replaceAll(path.sep, '/')
        return rel === '' || (!rel.startsWith('backups/') && rel !== 'backups')
      }
    })
    fs.cpSync(tempCopy, path.join(dir, '__dot_ai_toolops__'), { recursive: true })
    fs.rmSync(temp, { recursive: true, force: true })
    manifest.files.push({ path: '.ai-toolops', existed: true, backup: '__dot_ai_toolops__' })
  } else {
    manifest.files.push({ path: '.ai-toolops', existed: false })
  }

  for (const rel of paths) {
    if (rel === '.ai-toolops') continue
    const src = cwdPath(rel)
    if (!exists(src)) {
      manifest.files.push({ path: rel, existed: false })
      continue
    }
    const dest = path.join(dir, rel)
    ensureDir(path.dirname(dest))
    fs.cpSync(src, dest, { recursive: true })
    manifest.files.push({ path: rel, existed: true })
  }

  writeJson(path.join(dir, 'manifest.json'), manifest)
  return dir
}

export function rollbackLatest() {
  const backupRoot = cwdPath('.ai-toolops', 'backups')
  if (!exists(backupRoot)) return { restored: 0, message: '没有找到备份。' }
  const backups = fs.readdirSync(backupRoot).sort().reverse()
  if (!backups.length) return { restored: 0, message: '没有找到备份。' }

  const latest = path.join(backupRoot, backups[0])
  const manifestPath = path.join(latest, 'manifest.json')
  if (!exists(manifestPath)) return { restored: 0, message: '备份缺少 manifest。' }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-rollback-'))
  const safeBackup = path.join(temp, 'backup')
  fs.cpSync(latest, safeBackup, { recursive: true })

  const manifest = JSON.parse(fs.readFileSync(path.join(safeBackup, 'manifest.json'), 'utf8'))
  let restored = 0

  for (const item of manifest.files || []) {
    if (item.path === '.ai-toolops') continue
    const dest = cwdPath(item.path)
    if (!item.existed) {
      if (exists(dest)) fs.rmSync(dest, { recursive: true, force: true })
      continue
    }
    const src = path.join(safeBackup, item.path)
    if (!exists(src)) continue
    ensureDir(path.dirname(dest))
    fs.rmSync(dest, { recursive: true, force: true })
    fs.cpSync(src, dest, { recursive: true })
    restored += 1
  }

  const toolopsDest = cwdPath('.ai-toolops')
  fs.rmSync(toolopsDest, { recursive: true, force: true })
  if (manifest.toolopsExistedBefore) {
    fs.cpSync(path.join(safeBackup, '__dot_ai_toolops__'), toolopsDest, { recursive: true })
    restored += 1
  }

  fs.rmSync(temp, { recursive: true, force: true })
  return { restored, message: `已从 ${path.basename(latest)} 回滚。恢复 ${restored} 项。` }
}
