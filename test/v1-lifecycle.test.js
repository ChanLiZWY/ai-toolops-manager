import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { defaultLock, defaultPolicy, readProjectConfig, writeProjectConfig } from '../src/v1/config.js'
import { applyLifecycle, bootstrapLocked, planLifecycle } from '../src/v1/lifecycle.js'
import { readInventory } from '../src/v1/windows-store.js'
import { applyMigration, applyMigrationRollback, planMigration, planMigrationRollback } from '../src/v1/migration-executor.js'

function tempRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `ai-toolops-${name}-`))
}

test('rg Provider 支持事务安装、幂等、修复、跨项目复用和卸载', async (t) => {
  const root = tempRoot('生命周期 中文')
  const projectA = path.join(root, 'project A')
  const projectB = path.join(root, 'project B')
  const machineHome = path.join(root, 'Local App Data', 'ai-toolops')
  fs.mkdirSync(projectA, { recursive: true })
  fs.mkdirSync(projectB, { recursive: true })
  writeProjectConfig(projectA, defaultPolicy(), defaultLock())
  const artifact = makeRgArtifact(root)
  const server = await serveFile(artifact.zip, artifact.checksum)
  t.after(() => server.close())
  const source = `http://127.0.0.1:${server.address().port}/rg.zip`

  const plan = planLifecycle('install', 'rg', {
    projectRoot: projectA,
    machine: { home: machineHome },
    version: 'test',
    source,
    checksum: artifact.checksum
  })
  const dry = await applyLifecycle(plan, { machine: { home: machineHome }, dryRun: true })
  assert.equal(dry.dryRun, true)
  assert.equal(fs.existsSync(machineHome), false)

  const installed = await applyLifecycle(plan, { machine: { home: machineHome }, confirmed: true })
  assert.equal(installed.receipt.status, 'succeeded')
  const inventory = readInventory({ home: machineHome }).inventory
  assert.equal(inventory.tools.rg.version, 'test')
  assert.equal(fs.existsSync(inventory.tools.rg.invocation.command), true)

  const configA = readProjectConfig(projectA)
  assert.equal(configA.lock.tools.rg.version, 'test')
  assert.equal(configA.lock.tools.rg.artifact.url, source)
  assert.doesNotMatch(JSON.stringify(configA.lock), /Local App Data/)

  const repeat = await applyLifecycle(plan, { machine: { home: machineHome }, confirmed: true })
  assert.equal(repeat.result.entry.version, 'test')

  writeProjectConfig(projectB, defaultPolicy(), configA.lock)
  const boot = await bootstrapLocked({ projectRoot: projectB, machine: { home: machineHome }, dryRun: true })
  assert.equal(boot.plans.length, 0)

  fs.writeFileSync(inventory.tools.rg.invocation.command, 'broken')
  const repairPlan = planLifecycle('repair', 'rg', {
    projectRoot: projectA,
    machine: { home: machineHome },
    version: 'test',
    source,
    checksum: artifact.checksum
  })
  await applyLifecycle(repairPlan, { machine: { home: machineHome }, confirmed: true })
  const repaired = spawnSync(readInventory({ home: machineHome }).inventory.tools.rg.invocation.command, ['--version'], { encoding: 'utf8' })
  assert.equal(repaired.status, 0)

  const newMachine = path.join(root, 'new computer')
  const restored = await bootstrapLocked({ projectRoot: projectB, machine: { home: newMachine }, confirmed: true })
  assert.equal(restored.results.length, 1)
  assert.equal(readInventory({ home: newMachine }).inventory.tools.rg.version, 'test')

  const uninstallPlan = planLifecycle('uninstall', 'rg', {
    projectRoot: projectA,
    machine: { home: machineHome },
    version: 'test'
  })
  await applyLifecycle(uninstallPlan, { machine: { home: machineHome }, confirmed: true })
  assert.equal(readInventory({ home: machineHome }).inventory.tools.rg, undefined)
  assert.equal(readProjectConfig(projectA).lock.tools.rg, undefined)
})

test('正式迁移创建机器级备份并可回滚', async () => {
  const root = tempRoot('migration-apply')
  const project = path.join(root, 'project')
  const legacy = path.join(project, '.ai-toolops')
  const machineHome = path.join(root, 'machine')
  fs.mkdirSync(legacy, { recursive: true })
  fs.writeFileSync(path.join(legacy, 'equipment.json'), JSON.stringify({
    slots: { exact_search: { enabled: true, required: true, tools: ['rg'] } }
  }))
  fs.writeFileSync(path.join(legacy, 'skills.json'), JSON.stringify({ usageCount: 99 }))

  const plan = planMigration(project, { machine: { home: machineHome } })
  const result = await applyMigration(plan, { machine: { home: machineHome }, confirmed: true })
  assert.deepEqual(fs.readdirSync(legacy).sort(), ['policy.yaml', 'toolops.lock.json'])
  assert.equal(fs.existsSync(result.result.backup), true)

  const rollbackPlan = planMigrationRollback(project, result.result.migrationId, { machine: { home: machineHome } })
  await applyMigrationRollback(rollbackPlan, { machine: { home: machineHome }, confirmed: true })
  assert.equal(fs.existsSync(path.join(legacy, 'equipment.json')), true)
  assert.equal(fs.existsSync(path.join(legacy, 'skills.json')), true)
})

function makeRgArtifact(root) {
  const where = spawnSync('where.exe', ['rg.exe'], { encoding: 'utf8' })
  assert.equal(where.status, 0, '测试环境必须存在 rg.exe')
  const rg = where.stdout.split(/\r?\n/).map((item) => item.trim()).find(Boolean)
  const payload = path.join(root, 'payload', 'ripgrep-test')
  const zip = path.join(root, 'rg test.zip')
  fs.mkdirSync(payload, { recursive: true })
  fs.copyFileSync(rg, path.join(payload, 'rg.exe'))
  const script = `Compress-Archive -LiteralPath '${escapePowerShell(payload)}' -DestinationPath '${escapePowerShell(zip)}' -Force`
  const compressed = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' })
  assert.equal(compressed.status, 0, compressed.stderr)
  return {
    zip,
    checksum: crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex')
  }
}

function serveFile(file, checksum) {
  const server = http.createServer((req, res) => {
    if (req.url === '/rg.zip.sha256') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end(`${checksum}  rg.zip\n`)
      return
    }
    if (req.url === '/rg.zip') {
      res.writeHead(200, { 'content-type': 'application/zip' })
      fs.createReadStream(file).pipe(res)
      return
    }
    res.writeHead(404)
    res.end()
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

function escapePowerShell(value) {
  return String(value).replaceAll("'", "''")
}
