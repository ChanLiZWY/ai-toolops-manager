import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { applySelfUpdate, planSelfUpdate } from '../src/v1/self-update.js'

test('self-update 先暂存校验，再由 helper 替换并验证', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-self-update-'))
  const machine = { home: path.join(root, 'machine') }
  const target = path.join(root, '安装 目录', 'ai-toolops.exe')
  const source = path.join(root, '新版本.exe')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(process.execPath, target)
  fs.copyFileSync(process.execPath, source)
  const checksum = sha256(source)
  const plan = planSelfUpdate({ source, checksum, target, machine })

  const dry = await applySelfUpdate(plan, { machine, dryRun: true, launchHelper: false })
  assert.equal(dry.dryRun, true)
  assert.equal(fs.existsSync(machine.home), false)

  const staged = await applySelfUpdate(plan, { machine, confirmed: true, launchHelper: false })
  assert.equal(staged.result.status, 'staged')
  assert.equal(fs.existsSync(staged.result.staged), true)
  const result = spawnSync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', staged.result.helper,
    '-ParentPid', '999999',
    '-Target', target,
    '-Staged', staged.result.staged
  ], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(sha256(target), checksum)
  assert.equal(fs.existsSync(`${target}.backup`), false)
})

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}
