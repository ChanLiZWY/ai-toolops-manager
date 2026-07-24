import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { analyzeMigration } from './migration.js'
import { createActionPlan, executeTransaction } from './transaction.js'
import { projectPaths, writeProjectConfig } from './config.js'
import { windowsPaths } from './windows-store.js'

export function planMigration(projectRoot = process.cwd(), options = {}) {
  const report = analyzeMigration(projectRoot)
  if (!report.legacyFiles.length) throw new Error('没有发现可迁移的旧配置')
  const paths = projectPaths(projectRoot)
  const machine = windowsPaths(options.machine || {})
  return createActionPlan({
    action: 'migrate',
    providerId: 'core.migration',
    tool: 'project-config',
    changes: [
      { scope: 'project', operation: 'replace-legacy-config', target: paths.configRoot },
      { scope: 'machine', operation: 'create-backup', target: machine.migrations }
    ],
    permissions: { writePaths: [paths.configRoot, machine.migrations] },
    details: { projectRoot: paths.projectRoot, report }
  })
}

export async function applyMigration(plan, options = {}) {
  const paths = projectPaths(plan.details.projectRoot)
  const machinePaths = windowsPaths(options.machine || {})
  const migrationId = crypto.randomUUID()
  const migrationRoot = path.join(machinePaths.migrations, migrationId)
  const backup = path.join(migrationRoot, 'legacy')
  return executeTransaction(plan, async (transaction) => {
    assertProjectConfigTarget(paths)
    fs.mkdirSync(migrationRoot, { recursive: true })
    fs.cpSync(paths.configRoot, backup, { recursive: true })
    transaction.step('legacy.backup.created', { migrationId })
    fs.rmSync(paths.configRoot, { recursive: true, force: true })
    writeProjectConfig(paths.projectRoot, plan.details.report.preview.policy, plan.details.report.preview.lock)
    const manifest = {
      schemaVersion: 1,
      migrationId,
      projectRoot: paths.projectRoot,
      backup,
      createdAt: new Date().toISOString()
    }
    fs.writeFileSync(path.join(migrationRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    transaction.step('project.config.migrated')
    return manifest
  }, {
    machine: options.machine,
    dryRun: options.dryRun,
    confirmed: options.confirmed,
    rollback: async () => {
      if (fs.existsSync(backup)) {
        fs.rmSync(paths.configRoot, { recursive: true, force: true })
        fs.cpSync(backup, paths.configRoot, { recursive: true })
      }
      return { restored: fs.existsSync(paths.configRoot) }
    }
  })
}

export function planMigrationRollback(projectRoot, migrationId, options = {}) {
  const manifest = findMigration(projectRoot, migrationId, options)
  return createActionPlan({
    action: 'migrate-rollback',
    providerId: 'core.migration',
    tool: 'project-config',
    changes: [{ scope: 'project', operation: 'restore-legacy-config', target: projectPaths(projectRoot).configRoot }],
    permissions: { writePaths: [projectPaths(projectRoot).configRoot] },
    details: { projectRoot: path.resolve(projectRoot), manifest }
  })
}

export async function applyMigrationRollback(plan, options = {}) {
  const paths = projectPaths(plan.details.projectRoot)
  const manifest = plan.details.manifest
  return executeTransaction(plan, async (transaction) => {
    assertProjectConfigTarget(paths)
    if (!fs.existsSync(manifest.backup)) throw new Error(`迁移备份不存在：${manifest.backup}`)
    const currentBackup = path.join(path.dirname(manifest.backup), 'v1-before-rollback')
    fs.rmSync(currentBackup, { recursive: true, force: true })
    if (fs.existsSync(paths.configRoot)) fs.cpSync(paths.configRoot, currentBackup, { recursive: true })
    fs.rmSync(paths.configRoot, { recursive: true, force: true })
    fs.cpSync(manifest.backup, paths.configRoot, { recursive: true })
    transaction.step('legacy.config.restored')
    return { migrationId: manifest.migrationId, restored: paths.configRoot }
  }, {
    machine: options.machine,
    dryRun: options.dryRun,
    confirmed: options.confirmed,
    rollback: async () => ({ changed: false })
  })
}

function findMigration(projectRoot, migrationId, options) {
  const root = windowsPaths(options.machine || {}).migrations
  if (!fs.existsSync(root)) throw new Error('没有迁移记录')
  const ids = fs.readdirSync(root).sort().reverse()
  for (const id of ids) {
    if (migrationId && id !== migrationId) continue
    const file = path.join(root, id, 'manifest.json')
    if (!fs.existsSync(file)) continue
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (path.resolve(manifest.projectRoot).toLowerCase() === path.resolve(projectRoot).toLowerCase()) return manifest
  }
  throw new Error(migrationId ? `没有找到迁移记录：${migrationId}` : '当前项目没有可回滚迁移')
}

function assertProjectConfigTarget(paths) {
  if (path.basename(paths.configRoot) !== '.ai-toolops' || path.dirname(paths.configRoot).toLowerCase() !== paths.projectRoot.toLowerCase()) {
    throw new Error(`拒绝操作非项目配置目录：${paths.configRoot}`)
  }
}
