import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import test from 'node:test'
import { defaultLock, defaultPolicy, writeProjectConfig } from '../src/v1/config.js'
import { readInventory } from '../src/v1/windows-store.js'
import { startUiServer } from '../src/v1/ui/server.js'

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
