import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import {
  applyReleaseUpdate,
  checkLatestRelease,
  compareVersions,
  planReleaseUpdate
} from '../src/v1/release-update.js'

test('Release 检查只接受仓库稳定版安装资产和 GitHub 摘要', async () => {
  const digest = 'a'.repeat(64)
  const fetchImpl = async () => new Response(JSON.stringify({
    tag_name: 'v1.2.0',
    draft: false,
    prerelease: false,
    html_url: 'https://github.com/ChanLiZWY/ai-toolops-manager/releases/tag/v1.2.0',
    published_at: '2026-07-24T00:00:00Z',
    assets: [{
      name: 'ai-toolops-setup.exe',
      browser_download_url: 'https://github.com/ChanLiZWY/ai-toolops-manager/releases/download/v1.2.0/ai-toolops-setup.exe',
      size: 123,
      digest: `sha256:${digest}`
    }]
  }), { status: 200, headers: { 'content-type': 'application/json' } })

  const release = await checkLatestRelease({ fetchImpl, currentVersion: '1.1.0' })
  assert.equal(release.status, 'update-available')
  assert.equal(release.latestVersion, '1.2.0')
  assert.equal(release.asset.digest, digest)

  const ahead = await checkLatestRelease({ fetchImpl, currentVersion: '2.0.0' })
  assert.equal(ahead.status, 'ahead-of-release')
})

test('版本比较不会把旧 Release 当成更新', async () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1)
  assert.equal(compareVersions('v1.1.0', '1.1.0'), 0)
  assert.equal(compareVersions('1.0.9', '1.1.0'), -1)
})

test('Release 更新先下载校验并暂存安装包和退出后 helper', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-release-update-'))
  const machine = { home: path.join(root, 'machine') }
  const payload = Buffer.from('signed setup payload')
  const digest = crypto.createHash('sha256').update(payload).digest('hex')
  const release = {
    status: 'update-available',
    currentVersion: '1.1.0',
    latestVersion: '1.2.0',
    releaseUrl: 'https://example.invalid/release',
    asset: {
      name: 'ai-toolops-setup.exe',
      url: 'https://example.invalid/ai-toolops-setup.exe',
      size: payload.length,
      digest
    }
  }
  const target = path.join(root, '安装 目录', 'ai-toolops.exe')
  const plan = planReleaseUpdate(release, { machine, target })
  const result = await applyReleaseUpdate(plan, {
    machine,
    confirmed: true,
    launchHelper: false,
    fetchImpl: async () => new Response(payload, { status: 200 })
  })

  assert.equal(result.result.status, 'staged')
  assert.equal(result.result.version, '1.2.0')
  assert.equal(fs.readFileSync(result.result.staged).equals(payload), true)
  assert.match(fs.readFileSync(result.result.helper, 'utf8'), /--silent --install-root/)
})

test('Release 安装包摘要不匹配时事务失败并清理暂存文件', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-release-update-failed-'))
  const machine = { home: path.join(root, 'machine') }
  const release = {
    status: 'update-available',
    currentVersion: '1.1.0',
    latestVersion: '1.2.0',
    releaseUrl: 'https://example.invalid/release',
    asset: {
      name: 'ai-toolops-setup.exe',
      url: 'https://example.invalid/ai-toolops-setup.exe',
      size: 6,
      digest: '0'.repeat(64)
    }
  }
  const plan = planReleaseUpdate(release, {
    machine,
    target: path.join(root, 'install', 'ai-toolops.exe')
  })

  await assert.rejects(
    applyReleaseUpdate(plan, {
      machine,
      confirmed: true,
      launchHelper: false,
      fetchImpl: async () => new Response('broken', { status: 200 })
    }),
    /SHA-256 不匹配/
  )
  const cachedExecutables = fs.readdirSync(path.join(machine.home, 'cache')).filter((file) => file.endsWith('.exe'))
  assert.deepEqual(cachedExecutables, [])
})

test('退出后更新在 helper 完成前只记录 scheduled，不伪报 succeeded', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-release-update-scheduled-'))
  const machine = { home: path.join(root, 'machine') }
  const payload = Buffer.from('setup payload')
  const digest = crypto.createHash('sha256').update(payload).digest('hex')
  const release = {
    status: 'update-available',
    currentVersion: '1.1.0',
    latestVersion: '1.2.0',
    releaseUrl: 'https://example.invalid/release',
    asset: {
      name: 'ai-toolops-setup.exe',
      url: 'https://example.invalid/ai-toolops-setup.exe',
      size: payload.length,
      digest
    }
  }
  const plan = planReleaseUpdate(release, {
    machine,
    target: path.join(root, 'install', 'ai-toolops.exe')
  })
  let helperArgs = null
  const result = await applyReleaseUpdate(plan, {
    machine,
    confirmed: true,
    launchHelper: true,
    fetchImpl: async () => new Response(payload, { status: 200 }),
    spawnImpl: (_command, args) => {
      helperArgs = args
      return { unref() {} }
    }
  })

  assert.equal(result.receipt.status, 'scheduled')
  assert.equal(result.receipt.finishedAt, null)
  assert.equal(result.result.deferredCompletion, true)
  const receiptArgument = helperArgs.indexOf('-Receipt')
  assert.notEqual(receiptArgument, -1)
  assert.equal(path.resolve(helperArgs[receiptArgument + 1]), path.resolve(result.receiptFile))
  assert.match(fs.readFileSync(result.result.helper, 'utf8'), /Complete-Receipt -Status 'failed'/)
})

test('退出后安装失败时 helper 将 scheduled 回执改为 failed', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-release-helper-failed-'))
  const machine = { home: path.join(root, 'machine') }
  const fakeSetup = path.join(root, 'fake-setup.exe')
  compileFakeSetup(fakeSetup)
  const payload = fs.readFileSync(fakeSetup)
  const digest = crypto.createHash('sha256').update(payload).digest('hex')
  const installRoot = path.join(root, 'fail-install')
  const release = {
    status: 'update-available',
    currentVersion: '1.1.0',
    latestVersion: '1.2.0',
    releaseUrl: 'https://example.invalid/release',
    asset: {
      name: 'ai-toolops-setup.exe',
      url: 'https://example.invalid/ai-toolops-setup.exe',
      size: payload.length,
      digest
    }
  }
  const plan = planReleaseUpdate(release, {
    machine,
    installRoot,
    target: path.join(installRoot, 'ai-toolops.exe')
  })
  const staged = await applyReleaseUpdate(plan, {
    machine,
    confirmed: true,
    launchHelper: false,
    fetchImpl: async () => new Response(payload, { status: 200 })
  })
  const receipt = JSON.parse(fs.readFileSync(staged.receiptFile, 'utf8'))
  receipt.status = 'scheduled'
  receipt.finishedAt = null
  fs.writeFileSync(staged.receiptFile, `${JSON.stringify(receipt, null, 2)}\n`)

  const helper = spawnSync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', staged.result.helper,
    '-ParentPid', '999999',
    '-Setup', staged.result.staged,
    '-InstallRoot', installRoot,
    '-Target', plan.details.target,
    '-ExpectedVersion', release.latestVersion,
    '-Receipt', staged.receiptFile
  ], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
  assert.notEqual(helper.status, 0)

  const completed = JSON.parse(fs.readFileSync(staged.receiptFile, 'utf8'))
  assert.equal(completed.status, 'failed')
  assert.equal(completed.result.status, 'failed')
  assert.equal(completed.result.deferredCompletion, false)
  assert.equal(completed.error.code, 'UPDATE_HELPER_FAILED')
  assert.match(completed.error.message, /Setup failed/)
  assert.equal(fs.existsSync(staged.result.staged), false)
})

function compileFakeSetup(executable) {
  const source = path.join(path.dirname(executable), 'FakeSetup.cs')
  fs.writeFileSync(source, `
using System;
public static class FakeSetup {
  public static int Main(string[] args) {
    var rootIndex = Array.IndexOf(args, "--install-root");
    if (rootIndex >= 0 && rootIndex + 1 < args.Length && args[rootIndex + 1].Contains("fail-install")) return 9;
    return 0;
  }
}
`)
  const script = `Add-Type -Path '${source.replaceAll("'", "''")}' -OutputAssembly '${executable.replaceAll("'", "''")}' -OutputType ConsoleApplication`
  const result = spawnSync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-Command', script
  ], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
  assert.equal(result.status, 0, result.stderr || result.stdout)
}
