import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import test from 'node:test'
import { defaultLock, defaultPolicy, writeProjectConfig } from '../src/v1/config.js'
import { readInventory, windowsPaths } from '../src/v1/windows-store.js'
import { openUi, startUiServer } from '../src/v1/ui/server.js'
import { readUiSession, reuseUiSession } from '../src/v1/ui/session.js'

test('本地 UI 使用 token、服务器计划和真实应用服务', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-ui-'))
  const projectRoot = path.join(root, 'project')
  const secondProject = path.join(root, '项目 two')
  const machine = { home: path.join(root, 'machine') }
  fs.mkdirSync(projectRoot, { recursive: true })
  fs.mkdirSync(secondProject, { recursive: true })
  writeProjectConfig(projectRoot, defaultPolicy(), defaultLock())
  writeProjectConfig(secondProject, defaultPolicy(), defaultLock())
  const ui = startUiServer({
    projectRoot,
    machine,
    agent: 'generic',
    port: 0,
    open: false,
    pickDirectory: async () => secondProject
  })
  t.after(() => ui.server.close())
  await once(ui.server, 'listening')
  const base = `http://127.0.0.1:${ui.server.address().port}`

  const html = await fetch(`${base}/`).then((response) => response.text())
  assert.match(html, /class="skip-link"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /id="project-dialog"/)
  assert.match(html, /id="recent-projects"/)
  assert.doesNotMatch(html, /安装提示词|Skill 使用次数/)
  const css = await fetch(`${base}/styles.css`).then((response) => response.text())
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /:focus-visible/)

  const forbidden = await fetch(`${base}/api/state`)
  assert.equal(forbidden.status, 403)
  const headers = { 'x-ai-toolops-token': ui.token, 'content-type': 'application/json' }
  const stateResponse = await fetch(`${base}/api/state`, { headers })
  assert.equal(stateResponse.status, 200)
  const state = await stateResponse.json()
  assert.equal(state.context.agent.resolved, 'generic')
  assert.match(state.app.version, /^\d+\.\d+\.\d+$/)
  assert.equal(state.ui.current.root, projectRoot)

  const browseResponse = await fetch(`${base}/api/project/browse`, {
    method: 'POST',
    headers,
    body: '{}'
  })
  assert.equal(browseResponse.status, 200)
  assert.equal((await browseResponse.json()).selected, secondProject)

  const selectedResponse = await fetch(`${base}/api/project/select`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ project: secondProject })
  })
  const selectedBody = await selectedResponse.text()
  assert.equal(selectedResponse.status, 200, selectedBody)
  const selectedState = JSON.parse(selectedBody).state
  assert.equal(selectedState.context.project.root, secondProject)
  assert.equal(selectedState.ui.current.name, path.basename(secondProject))
  assert.equal(selectedState.ui.recent[0].root, projectRoot)

  const invalidProject = path.join(root, 'not-initialized')
  fs.mkdirSync(invalidProject)
  const invalidResponse = await fetch(`${base}/api/project/select`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ project: invalidProject })
  })
  assert.equal(invalidResponse.status, 400)

  const planResponse = await fetch(`${base}/api/plan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'external-register', tool: 'node-test', path: process.execPath })
  })
  assert.equal(planResponse.status, 200)
  const { plan } = await planResponse.json()
  assert.equal(plan.providerId, 'external-command')

  const applied = await fetch(`${base}/api/apply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ planId: plan.id })
  })
  assert.equal(applied.status, 200, await applied.text())
  assert.equal(readInventory(machine).inventory.tools['node-test'].source, 'external')

  const replay = await fetch(`${base}/api/apply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ planId: plan.id })
  })
  assert.equal(replay.status, 404)
})

test('UI 只有主动检查更新时访问 Release，并复用事务确认入口', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-ui-update-'))
  const projectRoot = path.join(root, 'project')
  const machine = { home: path.join(root, 'machine') }
  const payload = Buffer.from('setup payload')
  const digest = crypto.createHash('sha256').update(payload).digest('hex')
  let calls = 0
  fs.mkdirSync(projectRoot, { recursive: true })
  writeProjectConfig(projectRoot, defaultPolicy(), defaultLock())
  const fetchImpl = async (url) => {
    calls += 1
    if (String(url).includes('/releases/latest')) {
      return new Response(JSON.stringify({
        tag_name: 'v99.0.0',
        draft: false,
        prerelease: false,
        html_url: 'https://github.com/ChanLiZWY/ai-toolops-manager/releases/tag/v99.0.0',
        assets: [{
          name: 'ai-toolops-setup.exe',
          browser_download_url: 'https://github.com/ChanLiZWY/ai-toolops-manager/releases/download/v99.0.0/ai-toolops-setup.exe',
          size: payload.length,
          digest: `sha256:${digest}`
        }]
      }), { status: 200 })
    }
    return new Response(payload, { status: 200 })
  }
  const ui = startUiServer({
    projectRoot,
    machine,
    agent: 'generic',
    port: 0,
    open: false,
    fetchImpl,
    launchUpdateHelper: false,
    executable: path.join(root, 'install', 'ai-toolops.exe')
  })
  t.after(() => ui.server.close())
  await once(ui.server, 'listening')
  const base = `http://127.0.0.1:${ui.server.address().port}`
  const headers = { 'x-ai-toolops-token': ui.token, 'content-type': 'application/json' }

  await fetch(`${base}/api/state`, { headers })
  assert.equal(calls, 0)
  const checked = await fetch(`${base}/api/update/check`, { method: 'POST', headers, body: '{}' })
  assert.equal(checked.status, 200)
  const { plan } = await checked.json()
  assert.equal(plan.providerId, 'core.release-update')
  assert.equal(calls, 1)

  const applied = await fetch(`${base}/api/apply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ planId: plan.id })
  })
  assert.equal(applied.status, 200, await applied.text())
  assert.equal(calls, 2)
})

test('重复启动 UI 复用现有实例并转发显式项目', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-ui-session-'))
  const firstProject = path.join(root, 'first')
  const secondProject = path.join(root, '第二个 project')
  const machine = { home: path.join(root, 'machine') }
  fs.mkdirSync(firstProject, { recursive: true })
  fs.mkdirSync(secondProject, { recursive: true })
  writeProjectConfig(firstProject, defaultPolicy(), defaultLock())
  writeProjectConfig(secondProject, defaultPolicy(), defaultLock())

  const first = startUiServer({
    projectRoot: firstProject,
    machine,
    agent: 'generic',
    port: 0,
    open: false
  })
  t.after(() => first.server.close())
  await once(first.server, 'listening')

  const second = await openUi({
    projectRoot: secondProject,
    machine,
    port: 0,
    open: false,
    switchProject: true
  })
  assert.equal(second.reused, true)
  assert.equal(second.pid, process.pid)

  const base = `http://127.0.0.1:${first.server.address().port}`
  const response = await fetch(`${base}/api/state`, {
    headers: { 'x-ai-toolops-token': first.token }
  })
  const state = await response.json()
  assert.equal(state.context.project.root, secondProject)
})

test('两个同时启动的 UI 在端口竞争后收敛到单实例', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-ui-race-'))
  const projectRoot = path.join(root, 'project')
  const machine = { home: path.join(root, 'machine') }
  const port = 43000 + Math.floor(Math.random() * 1000)
  fs.mkdirSync(projectRoot, { recursive: true })
  writeProjectConfig(projectRoot, defaultPolicy(), defaultLock())

  const [first, second] = await Promise.all([
    openUi({ projectRoot, machine, agent: 'generic', port, open: false }),
    openUi({ projectRoot, machine, agent: 'generic', port, open: false })
  ])
  const owner = first.server ? first : second
  const reused = first.reused ? first : second
  t.after(() => owner.server.close())

  assert.equal(owner.server.listening, true)
  assert.equal(reused.reused, true)
  assert.equal(reused.pid, process.pid)
})

test('UI 会话文件拒绝非本机 URL，且不会向其发送项目路径', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-toolops-ui-untrusted-session-'))
  const machine = { home: path.join(root, 'machine') }
  const sessionFile = windowsPaths(machine).uiSession
  let requested = false
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true })
  fs.writeFileSync(sessionFile, JSON.stringify({
    schemaVersion: 1,
    pid: process.pid,
    port: 443,
    token: 'x'.repeat(32),
    url: 'https://example.invalid/'
  }))

  assert.equal(readUiSession(machine), null)
  assert.equal(await reuseUiSession({
    machine,
    projectRoot: root,
    switchProject: true,
    fetchImpl: async () => {
      requested = true
      throw new Error('must not run')
    }
  }), null)
  assert.equal(requested, false)
})
